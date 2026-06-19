"""
Configuración central. Lee variables de entorno (ver .env.example en la raíz del repo).

IMPORTANTE: nada aquí tiene relación con la criptografía de la bóveda (zero-knowledge).
Esto es solo configuración de infraestructura: DB, JWT de sesión de CUENTA, CORS, storage.
"""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    # DB
    database_url: str = "postgresql+psycopg2://legado:legado_dev_password@localhost:5432/legado_digital"

    # Auth de CUENTA (login). No confundir con master password / vaultKey de la bóveda.
    jwt_secret: str = "CHANGE_ME_dummy_dev_secret_do_not_use_in_prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 30  # 30 días, MVP. TODO: refresh tokens.

    # CORS. Acepta uno o varios orígenes separados por coma, p. ej.:
    #   FRONTEND_ORIGIN=https://midominio.vercel.app,https://www.midominio.com
    # En producción (front en Vercel, back en otro host) el origen del navegador es
    # DISTINTO al del backend, así que hay que listarlo aquí explícitamente — con
    # allow_credentials=True no se puede usar el comodín "*".
    frontend_origin: str = "http://localhost:3000"

    # Cookie de sesión: debe ser True en producción (HTTPS). En dev local sobre HTTP plano
    # (docker-compose con localhost:3000 -> localhost:8000) los navegadores y clientes HTTP
    # rechazan enviar de vuelta una cookie "Secure" si la conexión no es HTTPS — por eso esto
    # es configurable. Ver .env.example: COOKIE_SECURE=false para desarrollo local.
    cookie_secure: bool = True

    # SameSite de la cookie de sesión.
    #   - "lax"  para dev local (mismo sitio: localhost:3000 -> localhost:8000).
    #   - "none" OBLIGATORIO en producción cuando el front (Vercel) y el back (otro host)
    #     están en dominios distintos: con "lax"/"strict" el navegador NO adjunta la cookie
    #     en las peticiones fetch cross-site y la sesión se cae con 401. "none" exige
    #     además cookie_secure=True (solo viaja sobre HTTPS).
    cookie_samesite: str = "lax"

    # Carpeta donde LocalDiskStorage guarda los blobs cifrados. En hosts con disco efímero
    # (Render, Railway) hay que apuntar esto a un disco persistente montado (p. ej. /var/data)
    # o los documentos subidos se pierden en cada deploy/reinicio. Si es None, usa la carpeta
    # `backend/storage/` (válido solo para dev local). Ver services/storage_service.py.
    storage_dir: str | None = None

    # TODO: storage S3-compatible real para VaultDocument
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket_name: str = "legado-digital-vault-blobs"

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Muchos hosts (Render, Heroku, Railway) entregan la URL como "postgres://" o
        # "postgresql://" sin driver. SQLAlchemy 2.0 ya no acepta "postgres://", y aquí
        # queremos forzar siempre psycopg2 explícitamente. Normalizamos a
        # "postgresql+psycopg2://" sin tocar el resto de la URL (credenciales, host, query).
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix) and not v.startswith("postgresql+"):
                return "postgresql+psycopg2://" + v[len(prefix):]
        return v

    @property
    def cors_origins(self) -> list[str]:
        """Lista de orígenes permitidos para CORS, a partir de FRONTEND_ORIGIN (coma-separado)."""
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
