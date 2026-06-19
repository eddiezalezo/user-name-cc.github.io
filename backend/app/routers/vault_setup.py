"""
Setup, unlock y recuperación de la bóveda. El backend NUNCA recibe la master password,
la recovery key, ni la vaultKey en claro — solo blobs ya envueltos por el cliente.
Ver app/models/user.py (VaultProfile) para el detalle del esquema de envoltura doble.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User, VaultProfile
from app.schemas.user import (
    VaultProfileOut,
    VaultRecoveryOut,
    VaultRewrapRequest,
    VaultSetupRequest,
)
from app.services.audit_service import AuditAction, log_action

router = APIRouter(prefix="/vault", tags=["vault-setup"])


@router.post("/setup", response_model=VaultProfileOut, status_code=status.HTTP_201_CREATED)
def setup_vault(
    payload: VaultSetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultProfile:
    if current_user.vault_profile is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La bóveda ya fue configurada.")

    profile = VaultProfile(
        user_id=current_user.id,
        vault_salt=payload.vault_salt,
        protected_vault_key=payload.protected_vault_key,
        recovery_salt=payload.recovery_salt,
        protected_vault_key_recovery=payload.protected_vault_key_recovery,
        vault_header_check=payload.vault_header_check,
    )
    db.add(profile)
    current_user.has_recovery_key = True
    db.commit()
    db.refresh(profile)

    log_action(db, user_id=current_user.id, action=AuditAction.VAULT_SETUP_COMPLETED)
    return profile


@router.get("/unlock-material", response_model=VaultProfileOut)
def get_unlock_material(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultProfile:
    """
    El cliente pide esto al hacer login para poder pedirle la master password al usuario
    y derivar localmente la masterKey, descifrar protected_vault_key y verificar contra
    vault_header_check. Nada de esto es secreto del lado del servidor (son blobs cifrados).
    """
    if current_user.vault_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La bóveda no ha sido configurada.")
    return current_user.vault_profile


@router.get("/recovery-material", response_model=VaultRecoveryOut)
def get_recovery_material(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultProfile:
    """Igual que unlock-material pero para el flujo 'olvidé mi master password'."""
    if current_user.vault_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La bóveda no ha sido configurada.")
    return current_user.vault_profile


@router.post("/rewrap", response_model=VaultProfileOut)
def rewrap_vault_key(
    payload: VaultRewrapRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultProfile:
    """
    Tras cambiar la master password (o tras recuperar con recovery key y fijar una nueva),
    el cliente re-envuelve la vaultKey existente con la nueva masterKey y sube solo eso.
    Los datos ya cifrados (VaultItems, etc.) NO se tocan: siguen cifrados con la misma vaultKey.
    """
    profile = current_user.vault_profile
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La bóveda no ha sido configurada.")

    profile.protected_vault_key = payload.protected_vault_key
    profile.vault_header_check = payload.vault_header_check
    db.commit()
    db.refresh(profile)

    log_action(db, user_id=current_user.id, action=AuditAction.VAULT_PASSWORD_REWRAPPED)
    return profile
