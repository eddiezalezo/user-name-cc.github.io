import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.contact import Contact
from app.models.legacy import LegacyInstruction
from app.models.user import User
from app.schemas.legacy import LegacyInstructionCreate, LegacyInstructionOut, LegacyInstructionUpdate
from app.services.audit_service import AuditAction, log_action

router = APIRouter(prefix="/legacy-instructions", tags=["legacy-instructions"])


def _to_out(instruction: LegacyInstruction) -> LegacyInstructionOut:
    return LegacyInstructionOut(
        id=instruction.id,
        title=instruction.title,
        encrypted_body=instruction.encrypted_body,
        trigger=instruction.trigger,
        status=instruction.status,
        contact_ids=[c.id for c in instruction.contacts],
        created_at=instruction.created_at,
        updated_at=instruction.updated_at,
    )


def _resolve_contacts(db: Session, contact_ids: list[uuid.UUID], user: User) -> list[Contact]:
    if not contact_ids:
        return []
    contacts = db.query(Contact).filter(Contact.id.in_(contact_ids), Contact.user_id == user.id).all()
    if len(contacts) != len(set(contact_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uno o más contactos no son válidos.")
    return contacts


def _get_owned(db: Session, instruction_id: uuid.UUID, user: User) -> LegacyInstruction:
    instruction = db.get(LegacyInstruction, instruction_id)
    if instruction is None or instruction.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrucción no encontrada.")
    return instruction


@router.get("", response_model=list[LegacyInstructionOut])
def list_instructions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[LegacyInstructionOut]:
    instructions = (
        db.query(LegacyInstruction)
        .filter(LegacyInstruction.user_id == current_user.id)
        .order_by(LegacyInstruction.created_at.desc())
        .all()
    )
    return [_to_out(i) for i in instructions]


@router.post("", response_model=LegacyInstructionOut, status_code=status.HTTP_201_CREATED)
def create_instruction(
    payload: LegacyInstructionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LegacyInstructionOut:
    contacts = _resolve_contacts(db, payload.contact_ids, current_user)
    instruction = LegacyInstruction(
        user_id=current_user.id,
        title=payload.title,
        encrypted_body=payload.encrypted_body,
        trigger=payload.trigger,
        status=payload.status,
        contacts=contacts,
    )
    db.add(instruction)
    db.commit()
    db.refresh(instruction)

    log_action(db, user_id=current_user.id, action=AuditAction.LEGACY_INSTRUCTION_CHANGED, metadata={"instruction_id": str(instruction.id)})
    return _to_out(instruction)


@router.patch("/{instruction_id}", response_model=LegacyInstructionOut)
def update_instruction(
    instruction_id: uuid.UUID,
    payload: LegacyInstructionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LegacyInstructionOut:
    instruction = _get_owned(db, instruction_id, current_user)
    data = payload.model_dump(exclude_unset=True)

    if "contact_ids" in data:
        instruction.contacts = _resolve_contacts(db, data.pop("contact_ids"), current_user)
    for field, value in data.items():
        setattr(instruction, field, value)

    db.commit()
    db.refresh(instruction)
    log_action(db, user_id=current_user.id, action=AuditAction.LEGACY_INSTRUCTION_CHANGED, metadata={"instruction_id": str(instruction.id)})
    return _to_out(instruction)


@router.delete("/{instruction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instruction(
    instruction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    instruction = _get_owned(db, instruction_id, current_user)
    db.delete(instruction)
    db.commit()
