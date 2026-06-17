from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class CredentialCreate(BaseModel):
    provider_id: int
    username: str
    password: str
    custom_limits: Dict[str, Any] | None = None


class CredentialResponse(BaseModel):
    id: int
    provider_id: int
    custom_limits: Dict[str, Any] | None = None
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
    name: Optional[str] = None


class CookieResponse(BaseModel):
    id: int
    provider_id: int
    name: Optional[str] = None
    status: str
    downloads_used: int
    download_limit: Optional[int] = None
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DuplicateAction(BaseModel):
    action: str


class BillerBase(BaseModel):
    name: str
    url: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    description: Optional[str] = None

class BillerCreate(BillerBase):
    pass

class BillerUpdate(BillerBase):
    name: Optional[str] = None

class BillerResponse(BillerBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class ProviderBase(BaseModel):
    name: str
    base_url: str
    naming_pattern: Optional[str] = None
    separator: str = "_"
    space_replacement: str = "_"
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    description: Optional[str] = None
    automatic_limits: Optional[Dict[str, Any]] = None
    transparent_logo_bg: bool = False
    fit_logo_to_card: bool = False


class ProviderCreate(ProviderBase):
    pass


class ProviderResponse(ProviderBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SubscriptionTierBase(BaseModel):
    provider_id: int
    name: str
    level: Optional[int] = 0
    price: Optional[float] = None
    features: Optional[List[str]] = None

class SubscriptionTierCreate(SubscriptionTierBase):
    pass

class SubscriptionTierUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None
    price: Optional[float] = None
    features: Optional[List[str]] = None

class SubscriptionTierResponse(SubscriptionTierBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SubscriptionBase(BaseModel):
    provider_id: int
    tier_id: Optional[int] = None
    user_id: Optional[str] = None
    status: Optional[str] = "active"
    is_trial: Optional[bool] = False
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    biller_id: Optional[int] = None
    billing_cycle: Optional[str] = None
    cost: Optional[float] = None
    charge_type: Optional[str] = "bulk"
    installment_frequency: Optional[str] = "monthly"

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    provider_id: Optional[int] = None
    tier_id: Optional[int] = None
    user_id: Optional[str] = None
    status: Optional[str] = None
    is_trial: Optional[bool] = None
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    biller_id: Optional[int] = None
    billing_cycle: Optional[str] = None
    cost: Optional[float] = None
    charge_type: Optional[str] = None
    installment_frequency: Optional[str] = None

class SubscriptionResponse(SubscriptionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    biller: Optional[BillerResponse] = None
    provider: Optional[ProviderResponse] = None
    tier: Optional[SubscriptionTierResponse] = None
    model_config = ConfigDict(from_attributes=True)


class EmailParseRequest(BaseModel):
    email_text: str

class PeerNodeCreate(BaseModel):
    name: str
    peer_url: str
    outbound_key: str
    inbound_token: str
    recipe_sync_mode: Optional[str] = "auto_merge"
    sync_schedule: Optional[str] = "manual"
    library_scope: Optional[str] = "all_entries"
    allowed_providers: Optional[List[int]] = None


class PeerNodeUpdate(BaseModel):
    name: Optional[str] = None
    peer_url: Optional[str] = None
    outbound_key: Optional[str] = None
    inbound_token: Optional[str] = None
    status: Optional[str] = None
    recipe_sync_mode: Optional[str] = None
    sync_schedule: Optional[str] = None
    library_scope: Optional[str] = None
    allowed_providers: Optional[List[int]] = None


class PeerNodeResponse(BaseModel):
    id: int
    name: str
    peer_url: str
    outbound_key: str
    inbound_token: str
    status: str
    recipe_sync_mode: str
    sync_schedule: str
    library_scope: str
    allowed_providers: List[int]
    last_sync_at: Optional[datetime] = None
    next_run: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PeerSyncLogResponse(BaseModel):
    id: int
    peer_id: int
    direction: str
    recipes_synced: int
    media_synced: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
