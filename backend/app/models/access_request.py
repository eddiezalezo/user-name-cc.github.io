import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AccessRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    EXPIRED = "EXPIRED"


class AccessRequest(Base):
    """
    Creada por un Contact (heredero/albacea) usando su invite_token — NO requiere que el
    contacto tenga una cuenta completa en el MVP. El titular (en vida) la revisa y
    aprueba/deniega manualmente.

    Liberación de acceso (zero-knowledge real, no solo modelado):
      1. Al crear la solicitud, el navegador del CONTACTO genera un par de llaves X25519.
         Solo la PÚBLICA viaja al servidor (`contact_public_key`); la privada se la queda
         el contacto (se le muestra una vez, igual que la recovery key del titular).
      2. Si el titular aprueba y decide liberar, su navegador (con la bóveda desbloqueada)
         arma el paquete de datos autorizado, lo cifra con una clave simétrica nueva
         ("clave de liberación"), y sella esa clave contra `contact_public_key` usando
         crypto_box_seal (asimétrico). Sube ambos blobs ya cifrados/sellados.
      3. El backend nunca ve datos en claro ni la clave de liberación sin sellar.
      4. El contacto, con su llave privada guardada, es el único que puede abrir el sello
         y luego descifrar el paquete.
    """

    __tablename__ = "access_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[AccessRequestStatus] = mapped_column(
        SAEnum(AccessRequestStatus, name="access_request_status"), default=AccessRequestStatus.PENDING, nullable=False
    )

    # Llave pública X25519 (base64) generada en el navegador del contacto. No es secreta.
    contact_public_key: Mapped[str] = mapped_column(String(255), nullable=False)

    # Paquete liberado por el titular: clave de liberación sellada (crypto_box_seal) +
    # el payload cifrado simétricamente con esa clave. Ambos NULL hasta que se libera.
    sealed_release_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_release_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    contact: Mapped["Contact"] = relationship(back_populates="access_requests")
    user: Mapped["User"] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )

    # Enum como string libre controlado por el código (no SAEnum de DB) para poder agregar
    # nuevos tipos de acción sin migración. Ver app/services/audit_service.py para los valores.
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    log_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship()
    contact: Mapped["Contact | None"] = relationship()
