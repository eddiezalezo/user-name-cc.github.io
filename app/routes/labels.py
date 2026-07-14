"""Rutas de la API v1 de etiquetas."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.label import LabelRequest, NOMLabelData
from app.services import gemini_service, pdf_service

router = APIRouter(prefix="/api/v1/labels", tags=["labels"])


@router.post("/generate-mock", response_model=NOMLabelData)
def generate_mock(payload: LabelRequest) -> NOMLabelData:
    """Dictamen simulado: JSON con los campos obligatorios de la NOM-050."""
    return gemini_service._mock_dictamen(payload.ficha_tecnica, payload.tipo_nom)


@router.post("/generate-json", response_model=NOMLabelData)
def generate_json(payload: LabelRequest) -> NOMLabelData:
    """Dictamen real vía Gemini (structured outputs) en formato JSON."""
    try:
        return gemini_service.generar_datos_etiqueta(payload.ficha_tecnica, payload.tipo_nom)
    except Exception as exc:  # error de la API de Gemini o parseo
        raise HTTPException(status_code=502, detail=f"Error del motor de IA: {exc}") from exc


@router.post("/generate")
def generate_pdf(payload: LabelRequest) -> StreamingResponse:
    """Flujo completo: ficha técnica -> Gemini -> PDF térmico 4x3\" descargable."""
    try:
        datos = gemini_service.generar_datos_etiqueta(payload.ficha_tecnica, payload.tipo_nom)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error del motor de IA: {exc}") from exc

    buffer = pdf_service.generar_pdf_etiqueta(datos)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="etiqueta-nom050-4x3.pdf"'},
    )
