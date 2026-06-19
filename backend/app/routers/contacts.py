import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.contact import Contact
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactOut, ContactUpdate
from app.services.audit_service import AuditAction, log_action

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _get_owned_contact(db: Session, contact_id: uuid.UUID, user: User) -> Contact:
    contact = db.get(Contact, contact_id)
    if contact is None or contact.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contacto no encontrado.")
    return contact


@router.get("", response_model=list[ContactOut])
def list_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Contact]:
    return db.query(Contact).filter(Contact.user_id == current_user.id).order_by(Contact.created_at.desc()).all()


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(
    payload: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Contact:
    contact = Contact(user_id=current_user.id, **payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)

    log_action(db, user_id=current_user.id, action=AuditAction.CONTACT_CREATED, contact_id=contact.id)
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Contact:
    contact = _get_owned_contact(db, contact_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    contact = _get_owned_contact(db, contact_id, current_user)
    db.delete(contact)
    db.commit()
    log_action(db, user_id=current_user.id, action=AuditAction.CONTACT_REMOVED, metadata={"contact_id": str(contact_id)})
