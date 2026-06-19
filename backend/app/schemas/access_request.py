import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.access_request import AccessRequestStatus


class AccessRequestCreate(BaseModel):
    # El contacto se identifica por su invite_token, no por sesión autenticada.
    invite_token: str
    reason: str
    # Llave pública X25519 (base64) generada en el navegador del contacto. La privada
    # nunca se envía al servidor — ver app/models/access_request.py para el esquema completo.
    contact_public_key: str


class AccessRequestStatusUpdate(BaseModel):
    status: AccessRequestStatus


class AccessRequestReleasePayload(BaseModel):
    """Lo que sube el TITULAR para liberar acceso. Ambos campos ya están cifrados/sellados
    en su navegador; el backend no puede leerlos."""
    sealed_release_key: str
    encrypted_release_payload: str


class AccessRequestOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    reason: str
    status: AccessRequestStatus
    contact_public_key: str
    sealed_release_key: str | None
    encrypted_release_payload: str | None
    released_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
