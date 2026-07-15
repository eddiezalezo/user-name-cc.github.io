"""Punto de entrada de NOM-Label AI.

Ejecutar con:  uvicorn app.main:app --reload
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routes import labels

app = FastAPI(
    title="NOM-Label AI",
    description="Genera etiquetas NOM-050 listas para impresión térmica a partir de fichas técnicas en inglés.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(labels.router)

_ROOT = Path(__file__).resolve().parent.parent
_INDEX = _ROOT / "index.html"

app.mount("/static", StaticFiles(directory=_ROOT / "static"), name="static")


@app.get("/", include_in_schema=False)
def home() -> FileResponse:
    """Sirve la interfaz web minimalista."""
    return FileResponse(_INDEX)


@app.get("/health", include_in_schema=False)
def health() -> dict:
    return {"status": "ok"}
