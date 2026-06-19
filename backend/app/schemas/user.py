import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import PlanType


class UserRegister(BaseModel):
    email: EmailStr
    # Password de CUENTA (login). Nunca se usa para derivar claves de bóveda.
    password: str = Field(min_length=10, max_length=256)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    country: str | None = Field(default=None, min_length=2, max_length=2)


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    country: str | None
    plan: PlanType
    has_recovery_key: bool
    created_at: datetime

    class Config:
        from_attributes = True


class VaultSetupRequest(BaseModel):
    """
    Lo que el cliente envía DESPUÉS de generar y envolver la vaultKey localmente.
    El backend nunca ve la master password, la recovery key, ni la vaultKey en claro.
    """
    vault_salt: str
    protected_vault_key: str
    recovery_salt: str
    protected_vault_key_recovery: str
    vault_header_check: str


class VaultProfileOut(BaseModel):
    vault_salt: str
    protected_vault_key: str
    vault_header_check: str

    class Config:
        from_attributes = True


class VaultRecoveryOut(BaseModel):
    """Material necesario para recuperar la vaultKey usando la recovery key."""
    recovery_salt: str
    protected_vault_key_recovery: str
    vault_header_check: str

    class Config:
        from_attributes = True


class VaultRewrapRequest(BaseModel):
    """Tras cambiar la master password, el cliente re-envuelve la vaultKey y manda esto."""
    protected_vault_key: str
    vault_header_check: str
