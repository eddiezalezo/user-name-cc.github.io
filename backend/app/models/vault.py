import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VaultItemType(str, enum.Enum):
    ACCOUNT = "ACCOUNT"
    POLICY = "POLICY"
    PROPERTY = "PROPERTY"
    DOCUMENT = "DOCUMENT"
    NOTE = "NOTE"
    OTHER = "OTHER"


class DispositionType(str, enum.Enum):
    """Qué hacer con este ítem: marcarlo patrimonial vs afectivo, y entregar vs eliminar."""
    DELIVER = "DELIVER"
    DELETE = "DELETE"
    UNDEFINED = "UNDEFINED"


class VaultItem(Base):
    __tablename__ = "vault_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    type: Mapped[VaultItemType] = mapped_column(SAEnum(VaultItemType, name="vault_item_type"), nullable=False)

    # Título en claro (parcialmente buscable). El usuario debe evitar poner datos sensibles
    # aquí (ej: "Póliza GNP" está bien, "Póliza GNP 00482931" no). Lo sensible va cifrado.
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # Payload cifrado en cliente: institución, número de cuenta/póliza, ubicación física del
    # documento, beneficiario, notas, etc. Formato: "<nonce_b64>:<ciphertext_b64>".
    encrypted_payload: Mapped[str] = mapped_column(Text, nullable=False)

    # Tags genéricas en claro para filtrar (ej: "banco", "seguro-vida", "urgente").
    # El usuario decide qué tan genéricas son; no deben contener PII.
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)

    # Patrimonial (banco, póliza, inmueble) vs afectivo (carta, fotos, recuerdos)
    is_patrimonial: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    disposition: Mapped[DispositionType] = mapped_column(
        SAEnum(DispositionType, name="disposition_type"), default=DispositionType.UNDEFINED, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="vault_items")
    documents: Mapped[list["VaultDocument"]] = relationship(back_populates="vault_item", cascade="all, delete-orphan")


class VaultDocument(Base):
    __tablename__ = "vault_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vault_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vault_items.id", ondelete="CASCADE"), nullable=False
    )

    # Ubicación del blob YA CIFRADO en storage S3-compatible. El backend nunca ve el
    # contenido del archivo en claro, solo este puntero.
    # TODO: hoy es un path simulado; integrar boto3 / S3-compatible real (ver services/).
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)

    # Nombre de archivo, tipo, notas — cifrados en cliente. Formato "<nonce_b64>:<ciphertext_b64>".
    encrypted_metadata: Mapped[str] = mapped_column(Text, nullable=False)

    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # MIME real intencionalmente NO se guarda en claro (filtraría info del contenido);
    # si se necesita, debe ir dentro de encrypted_metadata.

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship()
    vault_item: Mapped["VaultItem"] = relationship(back_populates="documents")
