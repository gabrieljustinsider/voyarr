from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import DownloadRule, CustomList
from pydantic import BaseModel
from typing import Dict, Any, List

from dependencies import verify_api_key

router = APIRouter(
    prefix="/rules", tags=["rules"], dependencies=[Depends(verify_api_key)]
)


class RuleCreate(BaseModel):
    name: str
    criteria: Dict[str, Any]
    action: str = "download"
    scope: str = "global"
    is_active: bool = True


class ListCreate(BaseModel):
    name: str
    item_type: str
    items: List[str]


@router.post("/")
def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    db_rule = DownloadRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/")
def get_rules(db: Session = Depends(get_db)):
    return db.query(DownloadRule).all()


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(DownloadRule).filter(DownloadRule.id == rule_id).first()
    if rule:
        db.delete(rule)
        db.commit()
    return {"message": "Rule deleted"}


@router.post("/lists")
def create_custom_list(custom_list: ListCreate, db: Session = Depends(get_db)):
    db_list = CustomList(**custom_list.dict())
    db.add(db_list)
    db.commit()
    db.refresh(db_list)
    return db_list


@router.get("/lists")
def get_custom_lists(db: Session = Depends(get_db)):
    return db.query(CustomList).all()
