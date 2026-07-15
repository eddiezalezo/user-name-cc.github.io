"""Librería de Normas de NOM-Label AI.

Registro central de las NOM soportadas. Cada norma aporta sus reglas
específicas al System Prompt de Gemini y sus valores por defecto para el
dictamen simulado. Agregar una norma nueva = agregar una entrada aquí y
habilitarla en el selector del frontend; el esquema Pydantic y el motor
de PDF se reutilizan sin cambios.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class NormaNOM:
    clave: str
    nombre: str
    reglas_extra: str  # reglas específicas inyectadas al System Prompt
    mock_advertencias: list[str] = field(default_factory=list)
    mock_especificaciones: str = ""
    mock_rango_edad: str = ""


NOMS: dict[str, NormaNOM] = {
    "NOM-050-SCFI-2004": NormaNOM(
        clave="NOM-050-SCFI-2004",
        nombre="Información comercial — Etiquetado general de productos",
        reglas_extra=(
            "Aplica las reglas generales de etiquetado comercial. Los campos "
            "'especificaciones_electricas' y 'rango_edad' deben ir vacíos salvo "
            "que el producto claramente los amerite."
        ),
        mock_advertencias=[
            "Contiene batería de ion de litio. No exponer al fuego ni a temperaturas mayores a 45 °C.",
            "No apto para menores de 3 años: contiene piezas pequeñas.",
        ],
    ),
    "NOM-024-SCFI-2013": NormaNOM(
        clave="NOM-024-SCFI-2013",
        nombre="Información comercial — Aparatos electrónicos y eléctricos",
        reglas_extra=(
            "El producto es un aparato electrónico o eléctrico. OBLIGATORIO llenar "
            "'especificaciones_electricas' con las características de alimentación "
            "declaradas o inferibles de la ficha: tensión eléctrica en volts (V), "
            "frecuencia en hertz (Hz) cuando aplique y consumo de energía en watts (W) "
            "o corriente en amperes (A). Formato compacto, p. ej. "
            "'5 V c.c. — 1 A (USB-C) · 12 W'. Incluye advertencias sobre riesgo "
            "eléctrico y uso de adaptadores cuando corresponda. Si el producto "
            "requiere manual de operación, la leyenda de instructivo es obligatoria."
        ),
        mock_advertencias=[
            "Verifique que la tensión de alimentación coincida con la indicada antes de conectar.",
            "No desarme el aparato; no contiene partes reparables por el usuario.",
        ],
        mock_especificaciones="5 V c.c. — 1 A (USB-C) · 5 W",
    ),
    "NOM-015-SCFI-2007": NormaNOM(
        clave="NOM-015-SCFI-2007",
        nombre="Información comercial — Etiquetado para juguetes",
        reglas_extra=(
            "El producto es un juguete. OBLIGATORIO llenar 'rango_edad' con la edad "
            "recomendada en el formato exigido, p. ej. 'Recomendado para niños de "
            "3 años en adelante' o 'No recomendado para menores de 3 años'. Las "
            "advertencias deben incluir las leyendas precautorias aplicables: piezas "
            "pequeñas (riesgo de asfixia), bordes, cuerdas, proyectiles, baterías de "
            "botón o supervisión de un adulto, según los materiales y mecanismos "
            "descritos en la ficha."
        ),
        mock_advertencias=[
            "ADVERTENCIA: contiene piezas pequeñas, riesgo de asfixia.",
            "Úsese bajo la supervisión directa de un adulto.",
        ],
        mock_rango_edad="Recomendado para niños de 3 años en adelante",
    ),
}


def obtener_norma(tipo_nom: str) -> NormaNOM:
    """Regresa la norma registrada o lanza ValueError si no está soportada."""
    try:
        return NOMS[tipo_nom]
    except KeyError:
        soportadas = ", ".join(NOMS)
        raise ValueError(
            f"Norma no soportada: {tipo_nom!r}. Normas disponibles: {soportadas}."
        ) from None
