from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import DuplicateEntry, LibraryEntry
from pydantic import BaseModel
import os

router = APIRouter(prefix="/duplicates", tags=["duplicates"])

class ResolveRequest(BaseModel):
    action: str  # 'overwrite' or 'keep_both'

@router.get("/")
def get_duplicates(db: Session = Depends(get_db)):
    dupes = db.query(DuplicateEntry).filter(DuplicateEntry.resolved == False).all()
    result = []
    for d in dupes:
        le1 = db.query(LibraryEntry).filter(LibraryEntry.id == d.library_entry_id1).first()
        le2 = db.query(LibraryEntry).filter(LibraryEntry.id == d.library_entry_id2).first()
        
        result.append({
            "id": d.id,
            "similarity_score": d.similarity_score,
            "reason": d.reason,
            "entry1": {"id": le1.id, "title": le1.title, "path": le1.file_path} if le1 else None,
            "entry2": {"id": le2.id, "title": le2.title, "path": le2.file_path} if le2 else None
        })
    return result

@router.post("/{dupe_id}/resolve")
def resolve_duplicate(dupe_id: int, req: ResolveRequest, db: Session = Depends(get_db)):
    dupe = db.query(DuplicateEntry).filter(DuplicateEntry.id == dupe_id).first()
    if not dupe:
        raise HTTPException(status_code=404, detail="Duplicate entry not found")
        
    if req.action == 'overwrite':
        # Logic to delete entry1 and let entry2 take over
        le1 = db.query(LibraryEntry).filter(LibraryEntry.id == dupe.library_entry_id1).first()
        if le1:
            if os.path.exists(le1.file_path):
                try:
                    os.remove(le1.file_path)
                except OSError:
                    raise HTTPException(status_code=500, detail="Could not delete file due to lock or permissions.")
            db.delete(le1)
            
    # If action is keep_both, we just mark it resolved without deletion.
    dupe.resolved = True
    db.commit()
    return {"message": "Resolved"}