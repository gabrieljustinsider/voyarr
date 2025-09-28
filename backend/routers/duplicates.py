import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import DuplicateEntry
from schemas import DuplicateAction
from dependencies import verify_api_key
from tasks.duplicate_tasks import merge_duplicate_pair

router = APIRouter(
    prefix="/duplicates", tags=["duplicates"], dependencies=[Depends(verify_api_key)]
)


@router.get("")
def get_duplicates(db: Session = Depends(get_db)):
    dupes = (
        db.query(DuplicateEntry)
        .options(joinedload(DuplicateEntry.entry1), joinedload(DuplicateEntry.entry2))
        .filter(not DuplicateEntry.resolved)
        .all()
    )
    return dupes


@router.post("/{dupe_id}/resolve")
def resolve_duplicate(
    dupe_id: int, req: DuplicateAction, db: Session = Depends(get_db)
):
    dupe = db.query(DuplicateEntry).filter(DuplicateEntry.id == dupe_id).first()
    if not dupe:
        raise HTTPException(status_code=404, detail="Duplicate entry not found")

    if req.action == "keep_both":
        dupe.resolved = True
        db.commit()
    elif req.action in ["keep_1", "keep_2"]:
        entry_to_delete = dupe.entry2 if req.action == "keep_1" else dupe.entry1

        if entry_to_delete.file_path and os.path.exists(entry_to_delete.file_path):
            try:
                os.remove(entry_to_delete.file_path)
            except Exception as e:
                print(
                    f"Warning: Failed to delete physical file {entry_to_delete.file_path}: {e}"
                )

        db.delete(entry_to_delete)
        dupe.resolved = True
        db.commit()
    elif req.action in ["merge_1", "merge_2"]:
        keep_id = (
            dupe.library_entry_id1
            if req.action == "merge_1"
            else dupe.library_entry_id2
        )
        delete_id = (
            dupe.library_entry_id2
            if req.action == "merge_1"
            else dupe.library_entry_id1
        )

        try:
            merge_duplicate_pair(db, keep_id, delete_id)
            dupe.resolved = True
            db.commit()
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid action. Use keep_1, keep_2, keep_both, merge_1, or merge_2",
        )

    return {"message": "Duplicate resolved successfully"}
