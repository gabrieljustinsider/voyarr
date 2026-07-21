import logging
import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from database import get_db
from models import Subscription, SubscriptionTier, User
from schemas import (
    SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse,
    SubscriptionTierCreate, SubscriptionTierUpdate, SubscriptionTierResponse,
    EmailParseRequest
)
from routers.auth import get_current_user
from dependencies import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"], dependencies=[Depends(verify_api_key)])

# ==================== SUBSCRIPTION TIERS CRUD ====================

@router.get("/tiers", response_model=List[SubscriptionTierResponse])
def get_tiers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tiers = db.execute(select(SubscriptionTier)).scalars().all()
    return tiers

@router.get("/tiers/{tier_id}", response_model=SubscriptionTierResponse)
def get_tier(tier_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tier = db.get(SubscriptionTier, tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    return tier

@router.post("/tiers", response_model=SubscriptionTierResponse)
def create_tier(tier: SubscriptionTierCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage tiers")
    new_tier = SubscriptionTier(**tier.model_dump())
    db.add(new_tier)
    db.commit()
    db.refresh(new_tier)
    return new_tier

@router.put("/tiers/{tier_id}", response_model=SubscriptionTierResponse)
def update_tier(tier_id: int, tier_update: SubscriptionTierUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage tiers")
    tier = db.get(SubscriptionTier, tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    update_data = tier_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tier, key, value)
    
    db.commit()
    db.refresh(tier)
    return tier

@router.delete("/tiers/{tier_id}")
def delete_tier(tier_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage tiers")
    tier = db.get(SubscriptionTier, tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    db.delete(tier)
    db.commit()
    return {"message": "Tier deleted successfully"}


# ==================== SUBSCRIPTIONS CRUD ====================

@router.get("", response_model=List[SubscriptionResponse])
def get_subscriptions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # PERFORMANCE: Prevent 3x N+1 queries per subscription row
    stmt = select(Subscription).options(
        joinedload(Subscription.provider),
        joinedload(Subscription.tier),
        joinedload(Subscription.biller)
    )
    # if admin, can see all? Let's just return for current_user if regular
    if current_user.role == "admin":
        subs = db.execute(stmt).scalars().all()
    else:
        subs = db.execute(stmt.where(Subscription.user_id == current_user.id)).scalars().all()
    return subs

@router.get("/{sub_id}", response_model=SubscriptionResponse)
def get_subscription(sub_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.execute(
        select(Subscription)
        .options(joinedload(Subscription.provider), joinedload(Subscription.tier), joinedload(Subscription.biller))
        .where(Subscription.id == sub_id)
    ).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if current_user.role != "admin" and sub.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    return sub

@router.post("", response_model=SubscriptionResponse)
def create_subscription(sub: SubscriptionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dump = sub.model_dump()
    if not dump.get("user_id"):
        dump["user_id"] = current_user.id
    new_sub = Subscription(**dump)
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return new_sub

@router.put("/{sub_id}", response_model=SubscriptionResponse)
def update_subscription(sub_id: int, sub_update: SubscriptionUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if current_user.role != "admin" and sub.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = sub_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sub, key, value)
    
    db.commit()
    db.refresh(sub)
    return sub

@router.delete("/{sub_id}")
def delete_subscription(sub_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if current_user.role != "admin" and sub.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(sub)
    db.commit()
    return {"message": "Subscription deleted successfully"}

# ==================== SECURE DATA ====================

@router.get("/{sub_id}/reveal-card")
def reveal_subscription_card(sub_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.get(Subscription, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if current_user.role != "admin" and sub.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    decrypted_card_data = sub.get_secure_card_info(db)
    if not decrypted_card_data:
         raise HTTPException(status_code=404, detail="No secure data found")
         
    return {"card_info": decrypted_card_data}

# ==================== PARSERS ====================

@router.post("/parse-email")
def parse_email(req: EmailParseRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    text = req.email_text.lower()
    
    # Simple regex based extraction
    cost_match = re.search(r'\$([0-9]+\.[0-9]{2})', text)
    cost = float(cost_match.group(1)) if cost_match else None
    
    billing_cycle = "monthly" if "month" in text else "yearly" if "year" in text else None
    biller = None
    
    # Biller examples (Epoch, CCBill, etc.)
    if "epoch" in text:
        biller = "Epoch"
    elif "ccbill" in text:
        biller = "CCBill"
    elif "segpay" in text:
        biller = "Segpay"
    elif "verotel" in text:
        biller = "Verotel"
    
    is_trial = "trial" in text
    
    return {
        "status": "success",
        "parsed_data": {
            "cost": cost,
            "billing_cycle": billing_cycle,
            "biller": biller,
            "is_trial": is_trial,
            "status": "active"
        }
    }
