# NOM-Label AI

Micro-SaaS que convierte fichas técnicas en inglés (Alibaba / proveedor internacional) en **etiquetas NOM-050 listas para impresión térmica de 4×3 pulgadas**, para que el importador las envíe al fabricante en origen.

## Arquitectura

| Pieza | Tecnología | Archivo |
|---|---|---|
| Frontend (estilo Apple) | Tailwind CSS + Vanilla JS | `index.html` |
| Backend | FastAPI (Python) | `app/main.py`, `app/routes/labels.py` |
| Cerebro jurídico | Gemini API (`gemini-1.5-flash`, structured outputs) | `app/services/gemini_service.py` |
| Motor de render | ReportLab (PDF 101×76 mm, Code 128) | `app/services/pdf_service.py` |

## Puesta en marcha

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Opcional: sin esta variable la app usa un dictamen simulado
export GEMINI_API_KEY="tu_api_key"

uvicorn app.main:app --reload
```

Abre <http://127.0.0.1:8000> — la documentación interactiva de la API está en `/docs`.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/v1/labels/generate-mock` | JSON simulado con los campos obligatorios de la NOM-050 |
| `POST` | `/api/v1/labels/generate-json` | Dictamen real vía Gemini en JSON |
| `POST` | `/api/v1/labels/generate` | Flujo completo: devuelve el PDF 4×3″ descargable |

Cuerpo de la petición:

```json
{
  "ficha_tecnica": "Wireless running earphones, Bluetooth 5.3, lithium battery, made in China…",
  "tipo_nom": "NOM-050-SCFI-2004"
}
```

## Escalabilidad

Para agregar la **NOM-024** (electrónicos) o la **NOM-015** (juguetes) basta con duplicar el `SYSTEM_PROMPT` en `gemini_service.py` con las reglas de la nueva norma y registrar la opción en el selector del frontend — el esquema Pydantic y el motor de PDF se reutilizan sin cambios.

> ⚠️ Herramienta de apoyo al etiquetado. El dictamen final debe verificarse con un agente aduanal certificado.
