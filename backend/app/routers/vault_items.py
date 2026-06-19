import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.vault import VaultItem
from app.schemas.vault import VaultItemCreate, VaultItemOut, VaultItemUpdate

router = APIRouter(prefix="/vault-items", tags=["vault-items"])


def _get_owned_item(db: Session, item_id: uuid.UUID, user: User) -> VaultItem:
    item = db.get(VaultItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ítem no encontrado.")
    return item


@router.get("", response_model=list[VaultItemOut])
def list_vault_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[VaultItem]:
    return db.query(VaultItem).filter(VaultItem.user_id == current_user.id).order_by(VaultItem.created_at.desc()).all()


@router.post("", response_model=VaultItemOut, status_code=status.HTTP_201_CREATED)
def create_vault_item(
    payload: VaultItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultItem:
    item = VaultItem(user_id=current_user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=VaultItemOut)
def get_vault_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultItem:
    return _get_owned_item(db, item_id, current_user)


@router.patch("/{item_id}", response_model=VaultItemOut)
def update_vault_item(
    item_id: uuid.UUID,
    payload: VaultItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultItem:
    item = _get_owned_item(db, item_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vault_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    item = _get_owned_item(db, item_id, current_user)
    db.delete(item)
    db.commit()
