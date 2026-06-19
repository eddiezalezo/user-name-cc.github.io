import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.legacy import InstructionStatus, MessageStatus, MessageType, TriggerType


class LegacyInstructionCreate(BaseModel):
    title: str
    encrypted_body: str
    trigger: TriggerType
    contact_ids: list[uuid.UUID] = []
    status: InstructionStatus = InstructionStatus.DRAFT


class LegacyInstructionUpdate(BaseModel):
    title: str | None = None
    encrypted_body: str | None = None
    trigger: TriggerType | None = None
    contact_ids: list[uuid.UUID] | None = None
    status: InstructionStatus | None = None


class LegacyInstructionOut(BaseModel):
    id: uuid.UUID
    title: str
    encrypted_body: str
    trigger: TriggerType
    status: InstructionStatus
    contact_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class LegacyMessageCreate(BaseModel):
    contact_id: uuid.UUID
    type: MessageType = MessageType.TEXT
    encrypted_content: str
    trigger: TriggerType
    status: MessageStatus = MessageStatus.DRAFT


class LegacyMessageUpdate(BaseModel):
    encrypted_content: str | None = None
    trigger: TriggerType | None = None
    status: MessageStatus | None = None


class LegacyMessageOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    type: MessageType
    encrypted_content: str
    trigger: TriggerType
    status: MessageStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
