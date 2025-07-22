from pydantic import BaseModel, ConfigDict
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
    custom_limits: dict | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VideoChapterBase(BaseModel):
    title: str
    start_time: int
    end_time: Optional[int] = None
    tags: Optional[List[str]] = None

class VideoChapterCreate(VideoChapterBase):
    pass

class VideoChapterUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[int] = None
    end_time: Optional[int] = None
    tags: Optional[List[str]] = None

class VideoChapterResponse(VideoChapterBase):
    id: int
    library_entry_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

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
    entry_metadata: Optional[Dict[str, Any]] = None


class LibraryEntryCreate(LibraryEntryBase):
    pass


class LibraryEntryResponse(LibraryEntryBase):
    id: int
    last_updated: Optional[datetime] = None
    created_at: Optional[datetime] = None
    chapters: Optional[List[VideoChapterResponse]] = None

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


class CustomListBase(BaseModel):
    name: str
    item_type: str
    items: List[str]


class CustomListCreate(CustomListBase):
    pass


class CustomListResponse(CustomListBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DownloadRuleBase(BaseModel):
    name: str
    criteria: Optional[Dict[str, Any]] = None
    action: str = "download"
    scope: str = "global"
    is_active: bool = True


class DownloadRuleCreate(DownloadRuleBase):
    pass


class DownloadRuleResponse(DownloadRuleBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScrapeScheduleBase(BaseModel):
    provider_id: int
    name: str
    target_url: Optional[str] = None
    cron_expression: str
    action: str = "metadata_and_download"
    is_active: bool = True


class ScrapeScheduleCreate(ScrapeScheduleBase):
    pass


class ScrapeScheduleUpdate(BaseModel):
    provider_id: Optional[int] = None
    name: Optional[str] = None
    target_url: Optional[str] = None
    cron_expression: Optional[str] = None
    action: Optional[str] = None
    is_active: Optional[bool] = None


class ScrapeScheduleResponse(ScrapeScheduleBase):
    id: int
    last_run: Optional[datetime] = None
    last_run_status: Optional[str] = None
    last_run_details: Optional[str] = None
    next_run: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CookieCreate(BaseModel):
    provider_id: int
    cookie_text: str
    download_limit: Optional[int] = None


class CookieResponse(BaseModel):
    id: int
    provider_id: int
    status: str
    downloads_used: int
    download_limit: Optional[int] = None
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DuplicateAction(BaseModel):
    action: str


class ProviderBase(BaseModel):
    name: str
    base_url: str
    naming_pattern: Optional[str] = None
    separator: str = "_"
    space_replacement: str = "_"
    automatic_limits: Optional[Dict[str, Any]] = None


class ProviderCreate(ProviderBase):
    pass


class ProviderResponse(ProviderBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
