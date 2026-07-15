"""Cerebro jurídico de NOM-Label AI.

Usa la API de Gemini (gemini-1.5-flash) con Structured Outputs para
convertir una ficha técnica desordenada en inglés en el JSON de
cumplimiento de la NOM-050. Si no hay GEMINI_API_KEY configurada,
degrada a un dictamen simulado determinista para que la app funcione
de punta a punta en desarrollo.
"""

import hashlib
import json
import os

from app.models.label import NOMLabelData
from app.services.nom_registry import obtener_norma

SYSTEM_PROMPT = """\
Actúas como un dictaminador aduanal mexicano, perito certificado en Normas
Oficiales Mexicanas de información comercial. Hoy dictaminas bajo la
{clave}: {nombre}.
Recibirás la ficha técnica de un producto de importación, generalmente en
inglés técnico y desordenada. Tu trabajo:

1. TRADUCCIÓN LEGAL, NO LITERAL: convierte el nombre al español comercial
   genérico y descriptivo exigido por la norma. Ejemplo: "wireless running
   earphones" -> "Audífonos inalámbricos deportivos". Prohibido el lenguaje
   mercadotécnico ("increíble", "premium", "pro").
2. PAÍS DE ORIGEN: exprésalo en el formato legal exigido, p. ej.
   "Hecho en China", "Producto de EE.UU.". Si la ficha no lo indica,
   infiérelo del contexto o usa "Hecho en China" como valor por defecto
   señalándolo en advertencias.
3. ADVERTENCIAS OBLIGATORIAS: define las leyendas precautorias según el
   tipo de producto (baterías de litio, piezas pequeñas, uso eléctrico,
   contacto con alimentos, etc.). Siempre al menos una leyenda.
4. IMPORTADOR: si la ficha no trae datos del importador, usa el marcador
   "IMPORTADO POR: [RAZÓN SOCIAL DEL IMPORTADOR] RFC: [RFC]" para que el
   usuario lo sustituya.
5. CONTENIDO NETO: decláralo conforme a la NOM-030-SCFI (p. ej. "1 PIEZA",
   "CONT. NET. 250 ml").
6. INSTRUCTIVO: si el producto requiere manual de operación, incluye la
   leyenda condicional; si no aplica, deja el campo vacío.
7. CÓDIGO DE BARRAS: genera un contenido numérico EAN-13 de 13 dígitos
   coherente (prefijo 750 de México).

REGLAS ESPECÍFICAS DE LA {clave}:
{reglas_extra}

Responde EXCLUSIVAMENTE con el JSON del esquema solicitado, sin texto
adicional. Todo el contenido de la etiqueta debe ir en español.
"""


def _mock_dictamen(ficha_tecnica: str, tipo_nom: str) -> NOMLabelData:
    """Dictamen simulado determinista (sin llamada a Gemini)."""
    norma = obtener_norma(tipo_nom)
    digest = hashlib.sha1(ficha_tecnica.encode("utf-8")).hexdigest()
    barras = "750" + str(int(digest[:12], 16))[:10].ljust(10, "0")
    return NOMLabelData(
        producto_espanol="Audífonos inalámbricos deportivos",
        pais_origen="Hecho en China",
        importador_rfc="IMPORTADO POR: [RAZÓN SOCIAL DEL IMPORTADOR] RFC: [RFC]",
        contenido_neto="1 PIEZA",
        advertencias_seguridad=[
            *norma.mock_advertencias,
            f"Producto dictaminado bajo {norma.clave} (modo simulado, configure GEMINI_API_KEY).",
        ],
        instructivo="Consulte el instructivo de uso incluido en el empaque.",
        especificaciones_electricas=norma.mock_especificaciones,
        rango_edad=norma.mock_rango_edad,
        codigo_barras=barras,
    )


def generar_datos_etiqueta(ficha_tecnica: str, tipo_nom: str) -> NOMLabelData:
    """Traduce y estructura la ficha técnica bajo la NOM indicada.

    Usa Gemini con salida estructurada forzada al esquema NOMLabelData;
    sin API key regresa el dictamen simulado.
    """
    norma = obtener_norma(tipo_nom)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return _mock_dictamen(ficha_tecnica, tipo_nom)

    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=SYSTEM_PROMPT.format(
            clave=norma.clave, nombre=norma.nombre, reglas_extra=norma.reglas_extra
        ),
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": NOMLabelData,
            "temperature": 0.1,
        },
    )
    prompt = (
        f"Norma aplicable: {tipo_nom}\n\n"
        f"Ficha técnica del proveedor:\n\"\"\"\n{ficha_tecnica}\n\"\"\""
    )
    response = model.generate_content(prompt)
    return NOMLabelData.model_validate(json.loads(response.text))
