"""
Servicio centralizado para registrar auditoría. Mantener los valores de `action` aquí
como constantes evita strings mágicos regados por los routers.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.access_request import AuditLog


class AuditAction:
    CONTACT_CREATED = "CONTACT_CREATED"
    CONTACT_REMOVED = "CONTACT_REMOVED"
    LEGACY_INSTRUCTION_CHANGED = "LEGACY_INSTRUCTION_CHANGED"
    LEGACY_MESSAGE_CHANGED = "LEGACY_MESSAGE_CHANGED"
    ACCESS_REQUEST_CREATED = "ACCESS_REQUEST_CREATED"
    ACCESS_REQUEST_REVIEWED = "ACCESS_REQUEST_REVIEWED"
    ACCESS_REQUEST_RELEASED = "ACCESS_REQUEST_RELEASED"
    VAULT_SETUP_COMPLETED = "VAULT_SETUP_COMPLETED"
    VAULT_PASSWORD_REWRAPPED = "VAULT_PASSWORD_REWRAPPED"


def log_action(
    db: Session,
    *,
    user_id: uuid.UUID,
    action: str,
    contact_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        contact_id=contact_id,
        action=action,
        log_metadata=metadata or {},
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
