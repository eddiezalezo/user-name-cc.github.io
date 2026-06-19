import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.contact import Contact
from app.models.legacy import LegacyMessage
from app.models.user import User
from app.schemas.legacy import LegacyMessageCreate, LegacyMessageOut, LegacyMessageUpdate
from app.services.audit_service import AuditAction, log_action

router = APIRouter(prefix="/legacy-messages", tags=["legacy-messages"])


def _get_owned(db: Session, message_id: uuid.UUID, user: User) -> LegacyMessage:
    message = db.get(LegacyMessage, message_id)
    if message is None or message.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensaje no encontrado.")
    return message


@router.get("", response_model=list[LegacyMessageOut])
def list_messages(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[LegacyMessage]:
    return (
        db.query(LegacyMessage)
        .filter(LegacyMessage.user_id == current_user.id)
        .order_by(LegacyMessage.created_at.desc())
        .all()
    )


@router.post("", response_model=LegacyMessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    payload: LegacyMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LegacyMessage:
    contact = db.get(Contact, payload.contact_id)
    if contact is None or contact.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contacto destinatario no válido.")

    # TODO: AUDIO y VIDEO requieren capturar/cifrar el medio y asociarlo vía VaultDocument;
    # hoy solo se modela el flujo de TEXT end-to-end.
    message = LegacyMessage(user_id=current_user.id, **payload.model_dump())
    db.add(message)
    db.commit()
    db.refresh(message)

    log_action(db, user_id=current_user.id, action=AuditAction.LEGACY_MESSAGE_CHANGED, contact_id=contact.id)
    return message


@router.patch("/{message_id}", response_model=LegacyMessageOut)
def update_message(
    message_id: uuid.UUID,
    payload: LegacyMessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LegacyMessage:
    message = _get_owned(db, message_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(message, field, value)
    db.commit()
    db.refresh(message)
    return message


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    message = _get_owned(db, message_id, current_user)
    db.delete(message)
    db.commit()
