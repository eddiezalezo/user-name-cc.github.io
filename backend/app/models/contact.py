import enum
import secrets
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ContactRole(str, enum.Enum):
    SPOUSE = "SPOUSE"
    HEIR = "HEIR"
    EXECUTOR = "EXECUTOR"
    LAWYER = "LAWYER"
    OTHER = "OTHER"


def _generate_invite_token() -> str:
    # Token de invitación para que el contacto pueda crear una AccessRequest
    # SIN necesitar una cuenta completa en el MVP. Se entrega fuera de banda (email).
    return secrets.token_urlsafe(32)


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Nombre y email se guardan en claro: se necesitan para poder enviar invitaciones y
    # notificaciones. Si el usuario quiere más privacidad, puede usar alias en `name`.
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[ContactRole] = mapped_column(SAEnum(ContactRole, name="contact_role"), nullable=False)

    # Qué tipo de activos puede ver este contacto cuando se libere el acceso.
    # Ej: {"vault_item_types": ["ACCOUNT", "POLICY"], "legacy_instructions": true}
    permissions: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Teléfono, notas, relación, etc. Cifrado en cliente igual que el resto de datos sensibles.
    # Formato: "<nonce_b64>:<ciphertext_b64>" o NULL si no se capturó.
    encrypted_additional_info: Mapped[str | None] = mapped_column(Text, nullable=True)

    invite_token: Mapped[str] = mapped_column(String(64), unique=True, default=_generate_invite_token, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="contacts")
    access_requests: Mapped[list["AccessRequest"]] = relationship(back_populates="contact", cascade="all, delete-orphan")
