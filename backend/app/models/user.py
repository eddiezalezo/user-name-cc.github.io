import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanType(str, enum.Enum):
    FREE = "FREE"
    PERSONAL = "PERSONAL"
    FAMILIAR = "FAMILIAR"
    PATRIMONIAL = "PATRIMONIAL"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # Hash de la password de CUENTA (login). Independiente de la master password de bóveda.
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)  # ISO 3166-1 alpha-2

    plan: Mapped[PlanType] = mapped_column(SAEnum(PlanType, name="plan_type"), default=PlanType.FREE, nullable=False)
    has_recovery_key: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    vault_profile: Mapped["VaultProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    vault_items: Mapped[list["VaultItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    legacy_instructions: Mapped[list["LegacyInstruction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    legacy_messages: Mapped[list["LegacyMessage"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class VaultProfile(Base):
    """
    Material criptográfico ENVUELTO (wrapped) de la bóveda del usuario. Nada de esto
    es útil sin la master password o la recovery key del usuario — el backend solo
    almacena ciphertext + sales públicas, jamás claves en claro.

    Flujo (todo ocurre en el cliente, ver frontend/lib/crypto.ts):
      1. Setup: se genera vaultKey aleatoria (DEK). Se deriva masterKey = Argon2id(masterPassword, vault_salt).
         Se guarda protected_vault_key = AEAD_encrypt(vaultKey, key=masterKey).
         Se genera recoveryKey aleatoria (se muestra UNA vez al usuario para que la guarde).
         Se guarda protected_vault_key_recovery = AEAD_encrypt(vaultKey, key=KDF(recoveryKey, recovery_salt)).
      2. Unlock: el cliente pide vault_salt + protected_vault_key, deriva masterKey con la
         password introducida, intenta descifrar. Si el AEAD verifica, hay vaultKey en memoria.
      3. Recuperación: igual pero con recoveryKey + recovery_salt + protected_vault_key_recovery.
         Tras recuperar, el cliente puede re-envolver la vaultKey con una nueva master password.
    """

    __tablename__ = "vault_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Sal pública usada por Argon2id en el cliente para derivar masterKey de la master password
    vault_salt: Mapped[str] = mapped_column(String(255), nullable=False)
    # vaultKey envuelta (cifrada) con la masterKey. Formato: "<nonce_b64>:<ciphertext_b64>"
    protected_vault_key: Mapped[str] = mapped_column(String(2048), nullable=False)

    # Sal pública para derivar la clave a partir de la recovery key
    recovery_salt: Mapped[str] = mapped_column(String(255), nullable=False)
    # vaultKey envuelta con la clave derivada de la recovery key
    protected_vault_key_recovery: Mapped[str] = mapped_column(String(2048), nullable=False)

    # Blob de verificación: un payload conocido cifrado con vaultKey, para que el cliente
    # confirme que el unlock fue exitoso ANTES de intentar descifrar datos reales.
    vault_header_check: Mapped[str] = mapped_column(String(2048), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="vault_profile")
