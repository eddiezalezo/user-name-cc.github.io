"""Motor de renderizado de etiquetas térmicas de NOM-Label AI.

Genera un PDF vectorial en memoria con las dimensiones exactas de una
etiqueta térmica estándar de 4x3 pulgadas (101 mm x 76 mm), márgenes de
3 mm, tipografía Helvetica y un código de barras Code 128 legible por
escáner en la franja inferior.
"""

from io import BytesIO

from reportlab.graphics.barcode import code128
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from app.models.label import NOMLabelData

PAGE_W = 101 * mm
PAGE_H = 76 * mm
MARGIN = 3 * mm
CONTENT_W = PAGE_W - 2 * MARGIN
BARCODE_ZONE_H = 16 * mm

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
LINE_COLOR = 0.62  # gris tenue para líneas divisorias


def _draw_wrapped(c, text, x, y, font, size, max_w, leading=None):
    """Dibuja texto con salto de línea automático; regresa la nueva y."""
    leading = leading or size + 1.6
    for line in simpleSplit(text, font, size, max_w):
        c.setFont(font, size)
        c.drawString(x, y, line)
        y -= leading
    return y


def _divider(c, y):
    c.setLineWidth(0.4)
    c.setStrokeGray(LINE_COLOR)
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    return y - 3 * mm


def generar_pdf_etiqueta(datos: NOMLabelData) -> BytesIO:
    """Arma la etiqueta NOM-050 como PDF en memoria y regresa el buffer."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))
    c.setTitle("Etiqueta NOM-050 — NOM-Label AI")
    c.setFillGray(0)

    y = PAGE_H - MARGIN - 4 * mm

    # Nombre genérico del producto
    y = _draw_wrapped(c, datos.producto_espanol.upper(), MARGIN, y, FONT_BOLD, 11, CONTENT_W)
    y -= 1.5 * mm
    y = _divider(c, y)

    # Origen y contenido neto en una sola línea compacta
    c.setFont(FONT_BOLD, 7.5)
    c.drawString(MARGIN, y, datos.pais_origen.upper())
    c.setFont(FONT, 7.5)
    c.drawRightString(PAGE_W - MARGIN, y, datos.contenido_neto.upper())
    y -= 4 * mm

    # Importador responsable
    y = _draw_wrapped(c, datos.importador_rfc, MARGIN, y, FONT, 6.5, CONTENT_W)
    y -= 1 * mm
    y = _divider(c, y)

    # Advertencias de seguridad
    c.setFont(FONT_BOLD, 6.5)
    c.drawString(MARGIN, y, "ADVERTENCIAS:")
    y -= 3 * mm
    for adv in datos.advertencias_seguridad:
        y = _draw_wrapped(c, f"• {adv}", MARGIN, y, FONT, 6, CONTENT_W, leading=7.2)
        if y < MARGIN + BARCODE_ZONE_H + 6 * mm:
            break  # protege la franja del código de barras

    if datos.instructivo:
        y = _draw_wrapped(c, datos.instructivo, MARGIN, y, FONT, 6, CONTENT_W, leading=7.2)

    # Franja inferior: código de barras Code 128 centrado y legible
    barcode = code128.Code128(
        datos.codigo_barras,
        barHeight=9 * mm,
        barWidth=0.28 * mm,
        humanReadable=False,
        quiet=False,
    )
    bx = (PAGE_W - barcode.width) / 2
    by = MARGIN + 4 * mm
    barcode.drawOn(c, bx, by)
    c.setFont(FONT, 6.5)
    c.drawCentredString(PAGE_W / 2, MARGIN + 1 * mm, datos.codigo_barras)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
