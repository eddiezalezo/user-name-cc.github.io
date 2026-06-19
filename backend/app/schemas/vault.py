import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.vault import DispositionType, VaultItemType


class VaultItemCreate(BaseModel):
    type: VaultItemType
    title: str
    encrypted_payload: str
    tags: list[str] = []
    is_patrimonial: bool = True
    disposition: DispositionType = DispositionType.UNDEFINED


class VaultItemUpdate(BaseModel):
    title: str | None = None
    encrypted_payload: str | None = None
    tags: list[str] | None = None
    is_patrimonial: bool | None = None
    disposition: DispositionType | None = None


class VaultItemOut(BaseModel):
    id: uuid.UUID
    type: VaultItemType
    title: str
    encrypted_payload: str
    tags: list[str]
    is_patrimonial: bool
    disposition: DispositionType
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VaultDocumentOut(BaseModel):
    id: uuid.UUID
    vault_item_id: uuid.UUID
    storage_key: str
    encrypted_metadata: str
    size_bytes: int
    created_at: datetime

    class Config:
        from_attributes = True
