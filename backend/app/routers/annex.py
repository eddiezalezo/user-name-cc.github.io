"""
"Anexo de bienes digitales": genera una estructura JSON con el inventario del usuario,
pensada para alimentar un PDF exportable más adelante.

IMPORTANTE: como el backend nunca tiene los datos en claro (encrypted_payload sigue
cifrado), este endpoint solo puede exponer los campos en claro (title, type, tags,
disposition). El armado del PDF legible con los detalles reales debe hacerse en el
CLIENTE, después de descifrar cada VaultItem con la vaultKey.

TODO: implementar el render a PDF en el cliente (ver lib/pdf en frontend, no incluido
en este MVP) y/o un endpoint que reciba el JSON ya armado por el cliente y solo lo
convierta a PDF sin necesitar ver el contenido cifrado.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.vault import VaultItem

router = APIRouter(prefix="/legacy", tags=["annex"])


@router.get("/export-annex")
def export_annex(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    items = db.query(VaultItem).filter(VaultItem.user_id == current_user.id).all()
    return {
        "user_email": current_user.email,
        "generated_note": (
            "Este anexo solo lista metadatos en claro. Los detalles sensibles de cada "
            "ítem (números de cuenta, beneficiarios, ubicación de documentos, etc.) están "
            "cifrados y deben descifrarse en el cliente con la vaultKey antes de imprimir "
            "el documento final."
        ),
        "items": [
            {
                "id": str(item.id),
                "type": item.type.value,
                "title": item.title,
                "tags": item.tags,
                "is_patrimonial": item.is_patrimonial,
                "disposition": item.disposition.value,
                # encrypted_payload se incluye tal cual (cifrado) para que el cliente
                # lo descifre localmente si quiere construir el PDF completo.
                "encrypted_payload": item.encrypted_payload,
            }
            for item in items
        ],
    }
