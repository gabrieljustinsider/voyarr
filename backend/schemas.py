from pydantic import BaseModel
from typing import Optional

class CredentialCreate(BaseModel):
    provider_id: int
    username: str
    password: str
    custom_limits: dict | None = None

class CredentialResponse(BaseModel):
    id: int
    provider_id: int
    username: str
    custom_limits: dict | None = None
    created_at: str
