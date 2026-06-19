"""
Endpoints de documentos. El cliente cifra el archivo COMPLETO en el navegador (ver
frontend/lib/files.ts: usa encryptBytes de lib/crypto.ts) antes de que un solo byte
salga de su dispositivo. Este router solo mueve el blob ya cifrado y guarda metadatos
también cifrados — nunca ve contenido en claro, ni siquiera el nombre del archivo real.

TODO: ver app/services/storage_service.py para el TODO de migrar a S3 real y de
streaming/chunking para archivos grandes.
"""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.vault import VaultDocument, VaultItem
from app.schemas.vault import VaultDocumentOut
from app.services.storage_service import generate_storage_key, storage

router = APIRouter(prefix="/documents", tags=["documents"])

# Límite generoso para MVP — sin esto, un cliente podría intentar subir un blob gigante
# y tumbar el proceso al cargarlo completo en memoria (ver TODO de streaming).
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


def _get_owned_document(db: Session, document_id: uuid.UUID, user: User) -> VaultDocument:
    document = db.get(VaultDocument, document_id)
    if document is None or document.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado.")
    return document


@router.post("", response_model=VaultDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    vault_item_id: uuid.UUID = Form(...),
    # Nombre, tipo, notas — YA cifrados por el cliente. Formato "<nonce_b64>:<ciphertext_b64>".
    encrypted_metadata: str = Form(...),
    # El archivo en sí: también ya cifrado por el cliente (mismo formato, como bytes de texto).
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VaultDocument:
    vault_item = db.get(VaultItem, vault_item_id)
    if vault_item is None or vault_item.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VaultItem no encontrado.")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Archivo cifrado excede el límite de {MAX_UPLOAD_BYTES // (1024 * 1024)}MB para este MVP.",
        )

    storage_key = generate_storage_key(current_user.id, vault_item_id)
    size_bytes = storage.save(storage_key, content)

    document = VaultDocument(
        user_id=current_user.id,
        vault_item_id=vault_item_id,
        storage_key=storage_key,
        encrypted_metadata=encrypted_metadata,
        size_bytes=size_bytes,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/by-item/{vault_item_id}", response_model=list[VaultDocumentOut])
def list_documents_for_item(
    vault_item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[VaultDocument]:
    vault_item = db.get(VaultItem, vault_item_id)
    if vault_item is None or vault_item.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VaultItem no encontrado.")
    return db.query(VaultDocument).filter(VaultDocument.vault_item_id == vault_item_id).all()


@router.get("/{document_id}/download")
def download_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """
    Devuelve los bytes cifrados tal cual se guardaron. El cliente los descifra con su
    vaultKey (ver frontend/lib/files.ts). Se sirve como application/octet-stream genérico
    a propósito: el MIME real del archivo está dentro de encrypted_metadata, no aquí.
    """
    document = _get_owned_document(db, document_id, current_user)
    content = storage.read(document.storage_key)
    return Response(content=content, media_type="application/octet-stream")


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    document = _get_owned_document(db, document_id, current_user)
    storage.delete(document.storage_key)
    db.delete(document)
    db.commit()
