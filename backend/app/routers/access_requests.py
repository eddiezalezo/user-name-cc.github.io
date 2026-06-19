"""
Flujo de acceso de heredero/albacea. El contacto NO tiene cuenta completa en el MVP:
se identifica con el invite_token que el titular le compartió fuera de banda (email).

Liberación de acceso: ver el docstring completo en app/models/access_request.py. En
resumen, el backend solo transporta blobs cifrados/sellados — nunca puede leer qué se
libera ni descifrarlo.

TODO: hoy la revisión es solo lectura por polling desde el dashboard del titular. Falta:
  - Notificación real (email/SMS) al titular cuando se crea una AccessRequest.
  - Alguna verificación de identidad del contacto antes de aceptar el invite_token
    (ej. confirmar el email del contacto) para reducir riesgo de un token filtrado.
  - Ventana de espera / "break-glass" antes de liberar acceso, con posibilidad de que el
    titular (si sigue con vida) cancele la solicitud.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.access_request import AccessRequest, AccessRequestStatus
from app.models.contact import Contact
from app.models.user import User
from app.schemas.access_request import (
    AccessRequestCreate,
    AccessRequestOut,
    AccessRequestReleasePayload,
    AccessRequestStatusUpdate,
)
from app.services.audit_service import AuditAction, log_action

router = APIRouter(prefix="/access-requests", tags=["access-requests"])


@router.post("", response_model=AccessRequestOut, status_code=status.HTTP_201_CREATED)
def create_access_request(payload: AccessRequestCreate, db: Session = Depends(get_db)) -> AccessRequest:
    """Endpoint público (sin sesión): el contacto se autentica solo con su invite_token."""
    contact = db.query(Contact).filter(Contact.invite_token == payload.invite_token).first()
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token de invitación inválido.")

    access_request = AccessRequest(
        contact_id=contact.id,
        user_id=contact.user_id,
        reason=payload.reason,
        contact_public_key=payload.contact_public_key,
    )
    db.add(access_request)
    db.commit()
    db.refresh(access_request)

    log_action(
        db,
        user_id=contact.user_id,
        action=AuditAction.ACCESS_REQUEST_CREATED,
        contact_id=contact.id,
        metadata={"reason": payload.reason},
    )
    return access_request


@router.get("", response_model=list[AccessRequestOut])
def list_access_requests(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[AccessRequest]:
    """El titular (en vida) revisa solicitudes pendientes desde su dashboard."""
    return (
        db.query(AccessRequest)
        .filter(AccessRequest.user_id == current_user.id)
        .order_by(AccessRequest.created_at.desc())
        .all()
    )


@router.get("/lookup/{invite_token}", response_model=list[AccessRequestOut])
def lookup_requests_by_invite_token(invite_token: str, db: Session = Depends(get_db)) -> list[AccessRequest]:
    """
    Endpoint público: el CONTACTO usa esto para revisar el estado de sus propias
    solicitudes (y, si fueron liberadas, obtener el paquete sellado) sin necesitar cuenta.
    """
    contact = db.query(Contact).filter(Contact.invite_token == invite_token).first()
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token de invitación inválido.")
    return (
        db.query(AccessRequest)
        .filter(AccessRequest.contact_id == contact.id)
        .order_by(AccessRequest.created_at.desc())
        .all()
    )


@router.patch("/{request_id}", response_model=AccessRequestOut)
def review_access_request(
    request_id: uuid.UUID,
    payload: AccessRequestStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequest:
    access_request = db.get(AccessRequest, request_id)
    if access_request is None or access_request.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    access_request.status = payload.status
    db.commit()
    db.refresh(access_request)

    log_action(
        db,
        user_id=current_user.id,
        action=AuditAction.ACCESS_REQUEST_REVIEWED,
        contact_id=access_request.contact_id,
        metadata={"new_status": payload.status.value},
    )
    return access_request


@router.post("/{request_id}/release", response_model=AccessRequestOut)
def release_access(
    request_id: uuid.UUID,
    payload: AccessRequestReleasePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccessRequest:
    """
    El TITULAR sube aquí el paquete ya armado en su navegador (vault desbloqueada):
    una clave de liberación sellada contra `contact_public_key` + el payload cifrado con
    esa clave. El backend nunca ve nada en claro — solo guarda y sirve estos dos blobs.
    Requiere que la solicitud ya esté APPROVED.
    """
    access_request = db.get(AccessRequest, request_id)
    if access_request is None or access_request.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if access_request.status != AccessRequestStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se puede liberar acceso sobre una solicitud aprobada.",
        )

    access_request.sealed_release_key = payload.sealed_release_key
    access_request.encrypted_release_payload = payload.encrypted_release_payload
    access_request.released_at = func.now()
    db.commit()
    db.refresh(access_request)

    log_action(
        db,
        user_id=current_user.id,
        action=AuditAction.ACCESS_REQUEST_RELEASED,
        contact_id=access_request.contact_id,
    )
    return access_request
