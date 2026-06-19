"""
Configuración central. Lee variables de entorno (ver .env.example en la raíz del repo).

IMPORTANTE: nada aquí tiene relación con la criptografía de la bóveda (zero-knowledge).
Esto es solo configuración de infraestructura: DB, JWT de sesión de CUENTA, CORS, storage.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    # DB
    database_url: str = "postgresql+psycopg2://legado:legado_dev_password@localhost:5432/legado_digital"

    # Auth de CUENTA (login). No confundir con master password / vaultKey de la bóveda.
    jwt_secret: str = "CHANGE_ME_dummy_dev_secret_do_not_use_in_prod"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 30  # 30 días, MVP. TODO: refresh tokens.

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # Cookie de sesión: debe ser True en producción (HTTPS). En dev local sobre HTTP plano
    # (docker-compose con localhost:3000 -> localhost:8000) los navegadores y clientes HTTP
    # rechazan enviar de vuelta una cookie "Secure" si la conexión no es HTTPS — por eso esto
    # es configurable. Ver .env.example: COOKIE_SECURE=false para desarrollo local.
    cookie_secure: bool = True

    # TODO: storage S3-compatible real para VaultDocument
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket_name: str = "legado-digital-vault-blobs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
