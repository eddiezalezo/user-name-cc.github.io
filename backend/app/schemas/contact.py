import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.contact import ContactRole


class ContactCreate(BaseModel):
    name: str
    email: EmailStr
    role: ContactRole
    permissions: dict = {}
    # Cifrado en cliente antes de llegar aquí. None si el usuario no capturó info extra.
    encrypted_additional_info: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: ContactRole | None = None
    permissions: dict | None = None
    encrypted_additional_info: str | None = None


class ContactOut(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: ContactRole
    permissions: dict
    encrypted_additional_info: str | None
    invite_token: str
    created_at: datetime

    class Config:
        from_attributes = True
