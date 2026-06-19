import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID | None
    action: str
    log_metadata: dict
    created_at: datetime

    class Config:
        from_attributes = True
