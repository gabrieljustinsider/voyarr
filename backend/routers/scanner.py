from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from services.reverse_regex import ReverseRegexMatcher
from dependencies import verify_api_key

router = APIRouter(
    prefix="/scanner", tags=["scanner"], dependencies=[Depends(verify_api_key)]
)


class ScanRequest(BaseModel):
    directory: str
    provider_id: int
    pattern: str


@router.post("/scan")
def trigger_scan(request: ScanRequest, db: Session = Depends(get_db)):
    matcher = ReverseRegexMatcher(db)
    result = matcher.scan_directory(
        request.directory, request.provider_id, request.pattern
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
