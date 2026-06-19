from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registra todos los modelos en Base.metadata)
from app.config import get_settings
from app.database import Base, engine
from app.routers import (
    access_requests,
    annex,
    audit,
    auth,
    contacts,
    documents,
    legacy_instructions,
    legacy_messages,
    vault_items,
    vault_setup,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # TODO: reemplazar por migraciones Alembic antes de producción.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Legado Digital API",
    description=(
        "API zero-knowledge para organización de expediente patrimonial digital. "
        "Este servicio nunca recibe ni almacena datos sensibles en texto claro: solo "
        "blobs cifrados por el cliente y metadatos mínimos."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # necesario para que la cookie HttpOnly de sesión viaje
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(vault_setup.router)
app.include_router(vault_items.router)
app.include_router(documents.router)
app.include_router(contacts.router)
app.include_router(legacy_instructions.router)
app.include_router(legacy_messages.router)
app.include_router(access_requests.router)
app.include_router(audit.router)
app.include_router(annex.router)


@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}
