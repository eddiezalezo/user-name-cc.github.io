# RadarNewsOS — MVP

**El Guardián del Margen Delivery.** SaaS vertical que detecta la fuga silenciosa de ganancias de los restaurantes en las apps de delivery (Rappi, DiDi Food, Uber Eats): comisiones, inflación de insumos, mermas y retenciones fiscales mexicanas.

## Qué incluye este MVP

Una demo interactiva en un solo archivo (`index.html`), sin dependencias ni backend, lista para servirse con GitHub Pages:

- **Inicio** — propuesta de valor, garantía ($15,000 MXN/mes en fugas o es gratis) y precios (Freemium / Pro $79 USD por sucursal).
- **Módulo 1 · Auditor de Delivery (gratis, funcional)** — captura tus 5 platillos estrella, apps y comisiones, y régimen fiscal (Persona Física/Moral). El motor calcula el margen real por platillo × app y lo presenta como semáforo financiero (rojo / amarillo / verde) con precio sugerido y fuga mensual estimada. Todo corre en el navegador.
- **Módulo 2 · Panel de Control Pro (demo interactiva)** — KPIs, monitor de inflación de insumos, alertas simuladas de WhatsApp, cambio de precios con 1 clic (simulado) y simulador de promociones (2×1, envío gratis, descuento).
- **Plan de negocio** — ICP, monetización, go-to-market y riesgos, para presentar a socios.

## Cómo verlo

- Local: abre `index.html` en cualquier navegador.
- Publicado: al hacer merge a la rama principal, GitHub Pages lo sirve automáticamente en `https://user-name-cc.github.io`.

## Notas

- Los datos precargados (Smash Burgers La Capital) son de demostración; todos los campos del auditor son editables.
- Los cálculos fiscales (retención ISR 1% + IVA 8% del régimen de Plataformas Tecnológicas) están simplificados con fines ilustrativos y no constituyen asesoría fiscal.
- La integración real por API con Rappi/DiDi/Uber Eats y las alertas de WhatsApp son la siguiente fase; aquí están simuladas.
