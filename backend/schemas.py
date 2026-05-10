from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

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

class LibraryEntryBase(BaseModel):
    provider_id: int
    title: str
    performers: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    file_path: str
    file_size: Optional[int] = None
    resolution: Optional[str] = None
    duration: Optional[int] = None
    ohash: Optional[str] = None
    phash: Optional[str] = None
    site_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class LibraryEntryCreate(LibraryEntryBase):
    pass

class LibraryEntryResponse(LibraryEntryBase):
    id: int
    last_updated: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class LocalFileBase(BaseModel):
    media_entry_id: int
    file_path: str
    file_size: Optional[int] = None
    resolution: Optional[str] = None
    matched: bool = False

class LocalFileCreate(LocalFileBase):
    pass

class LocalFileResponse(LocalFileBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class CustomListBase(BaseModel):
    name: str
    item_type: str
    items: List[str]

class CustomListCreate(CustomListBase):
    pass

class CustomListResponse(CustomListBase):
    id: int
    created_at: Optional[datetime] = None
    class Config:
        orm_mode = True

class DownloadRuleBase(BaseModel):
    name: str
    criteria: Dict[str, Any]
    action: str = 'download'
    scope: str = 'global'
    is_active: bool = True

class DownloadRuleCreate(DownloadRuleBase):
    pass

class DownloadRuleResponse(DownloadRuleBase):
    id: int
    created_at: Optional[datetime] = None
    class Config:
        orm_mode = True
