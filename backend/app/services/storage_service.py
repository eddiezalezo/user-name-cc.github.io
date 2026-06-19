"""
Storage de blobs cifrados, detrás de una interfaz pensada para que cambiar a S3 real sea
un cambio de UNA clase, no de los routers que la usan.

Implementación activa: disco local (carpeta `storage/` en la raíz del backend). El backend
NUNCA descifra ni inspecciona el contenido — solo mueve bytes opacos que el cliente ya
cifró antes de subirlos (ver frontend/lib/files.ts).

TODO: reemplazar LocalDiskStorage por una implementación S3-compatible (boto3 + endpoint
configurable, ver app/config.py: s3_endpoint_url, s3_access_key_id, s3_secret_access_key,
s3_bucket_name) antes de producción. La interfaz (save/read/delete) no debería cambiar,
así que los routers no necesitarían tocarse — solo la inyección de qué implementación usar.

TODO: para archivos grandes, esto carga el blob completo en memoria tanto al subir como al
bajar. Falta streaming/chunking real en cliente y servidor para archivos de varios cientos
de MB (videos de mensajes póstumos, por ejemplo).
"""
import uuid
from pathlib import Path

STORAGE_ROOT = Path(__file__).resolve().parent.parent.parent / "storage"


class LocalDiskStorage:
    def __init__(self, root: Path = STORAGE_ROOT):
        # Siempre resuelto a absoluto: si no, la defensa de path traversal en _resolve()
        # puede comparar una ruta relativa contra una absoluta y fallar incorrectamente
        # (encontrado durante pruebas de integración apuntando a un root relativo).
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, storage_key: str) -> Path:
        # Defensa simple contra path traversal: nunca permitir salir de self.root.
        path = (self.root / storage_key).resolve()
        if self.root not in path.parents and path != self.root:
            raise ValueError("storage_key inválida.")
        return path

    def save(self, storage_key: str, content: bytes) -> int:
        path = self._resolve(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return len(content)

    def read(self, storage_key: str) -> bytes:
        return self._resolve(storage_key).read_bytes()

    def delete(self, storage_key: str) -> None:
        path = self._resolve(storage_key)
        if path.exists():
            path.unlink()


storage = LocalDiskStorage()


def generate_storage_key(user_id: uuid.UUID, vault_item_id: uuid.UUID, filename_hint: str = "blob") -> str:
    return f"vaults/{user_id}/{vault_item_id}/{uuid.uuid4()}-{filename_hint}.enc"
