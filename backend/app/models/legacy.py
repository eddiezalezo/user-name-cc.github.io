import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TriggerType(str, enum.Enum):
    DEATH = "DEATH"
    INCAPACITY = "INCAPACITY"
    TIME_DELAY = "TIME_DELAY"
    OTHER = "OTHER"


class InstructionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    AUDIO = "AUDIO"  # TODO: implementar captura/cifrado de audio
    VIDEO = "VIDEO"  # TODO: implementar captura/cifrado de video


class MessageStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    DELIVERED = "DELIVERED"
    REVOKED = "REVOKED"


# Tabla de asociación N:N entre LegacyInstruction y Contact (destinatarios)
instruction_contacts = Table(
    "instruction_contacts",
    Base.metadata,
    Column("instruction_id", UUID(as_uuid=True), ForeignKey("legacy_instructions.id", ondelete="CASCADE"), primary_key=True),
    Column("contact_id", UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
)


class LegacyInstruction(Base):
    __tablename__ = "legacy_instructions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Cuerpo de la instrucción, cifrado en cliente. Formato "<nonce_b64>:<ciphertext_b64>".
    encrypted_body: Mapped[str] = mapped_column(Text, nullable=False)

    trigger: Mapped[TriggerType] = mapped_column(SAEnum(TriggerType, name="trigger_type"), nullable=False)
    status: Mapped[InstructionStatus] = mapped_column(
        SAEnum(InstructionStatus, name="instruction_status"), default=InstructionStatus.DRAFT, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="legacy_instructions")
    contacts: Mapped[list["Contact"]] = relationship(secondary=instruction_contacts)


class LegacyMessage(Base):
    __tablename__ = "legacy_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)

    type: Mapped[MessageType] = mapped_column(SAEnum(MessageType, name="message_type"), default=MessageType.TEXT, nullable=False)
    # Contenido cifrado: texto, o referencia a un VaultDocument para audio/video.
    # Formato "<nonce_b64>:<ciphertext_b64>".
    encrypted_content: Mapped[str] = mapped_column(Text, nullable=False)

    trigger: Mapped[TriggerType] = mapped_column(SAEnum(TriggerType, name="message_trigger_type"), nullable=False)
    status: Mapped[MessageStatus] = mapped_column(
        SAEnum(MessageStatus, name="message_status"), default=MessageStatus.DRAFT, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="legacy_messages")
    contact: Mapped["Contact"] = relationship()
