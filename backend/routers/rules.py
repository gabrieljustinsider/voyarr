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


@router.get("/{rule_id}")
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    rule = db.query(DownloadRule).filter(DownloadRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.put("/{rule_id}")
def update_rule(rule_id: int, rule: RuleCreate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    db_rule = db.query(DownloadRule).filter(DownloadRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    db_rule.name = rule.name
    db_rule.criteria = rule.criteria
    db_rule.action = rule.action
    db_rule.scope = rule.scope
    db_rule.is_active = rule.is_active
    
    db.commit()
    db.refresh(db_rule)
    return db_rule


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


@router.get("/lists/{list_id}")
def get_custom_list(list_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    custom_list = db.query(CustomList).filter(CustomList.id == list_id).first()
    if not custom_list:
        raise HTTPException(status_code=404, detail="Custom list not found")
    return custom_list


@router.put("/lists/{list_id}")
def update_custom_list(list_id: int, custom_list: ListCreate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    db_list = db.query(CustomList).filter(CustomList.id == list_id).first()
    if not db_list:
        raise HTTPException(status_code=404, detail="Custom list not found")
    
    db_list.name = custom_list.name
    db_list.item_type = custom_list.item_type
    db_list.items = custom_list.items
    
    db.commit()
    db.refresh(db_list)
    return db_list


@router.delete("/lists/{list_id}")
def delete_custom_list(list_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    custom_list = db.query(CustomList).filter(CustomList.id == list_id).first()
    if not custom_list:
        raise HTTPException(status_code=404, detail="Custom list not found")
    
    db.delete(custom_list)
    db.commit()
    return {"message": "Custom list deleted"}
