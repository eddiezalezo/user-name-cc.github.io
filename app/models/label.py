"""Esquemas Pydantic para NOM-Label AI.

NOMLabelData refleja los campos de información comercial obligatoria
de la NOM-050-SCFI-2004 para productos de importación.
"""

from pydantic import BaseModel, Field


class LabelRequest(BaseModel):
    """Petición de generación: ficha técnica cruda + norma aplicable."""

    ficha_tecnica: str = Field(
        ...,
        min_length=1,
        description="Ficha técnica del producto tal como viene del proveedor (inglés, desordenada).",
    )
    tipo_nom: str = Field(
        default="NOM-050-SCFI-2004",
        description="Norma Oficial Mexicana aplicable al producto.",
    )


class NOMLabelData(BaseModel):
    """JSON estructurado con los campos obligatorios de etiquetado NOM-050."""

    producto_espanol: str = Field(
        ...,
        description="Nombre genérico del producto en español comercial legal (no mercadotécnico).",
    )
    pais_origen: str = Field(
        ...,
        description='País de origen en formato legal, p. ej. "Hecho en China".',
    )
    importador_rfc: str = Field(
        ...,
        description="Razón social y RFC del importador responsable.",
    )
    contenido_neto: str = Field(
        ...,
        description="Contenido o contenido neto conforme a la NOM-030-SCFI, p. ej. '1 PIEZA'.",
    )
    advertencias_seguridad: list[str] = Field(
        ...,
        description="Leyendas precautorias obligatorias según los insumos o uso del producto.",
    )
    instructivo: str = Field(
        default="",
        description="Leyenda condicional sobre instructivo de uso, vacía si no aplica.",
    )
    especificaciones_electricas: str = Field(
        default="",
        description="NOM-024: tensión (V), frecuencia (Hz) y consumo (W/A); vacío si no aplica.",
    )
    rango_edad: str = Field(
        default="",
        description="NOM-015: edad recomendada del juguete; vacío si no aplica.",
    )
    codigo_barras: str = Field(
        ...,
        description="Contenido numérico del código de barras (EAN-13 simulado de 13 dígitos).",
    )
