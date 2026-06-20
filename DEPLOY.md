# Despliegue público de Legado Digital

## 🚀 Publicar rápido (3 clics)

**1. Backend + Postgres en Render** — pulsa el botón, inicia sesión en Render y *Apply*
(lee `render.yaml` solo):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/eddiezalezo/user-name-cc.github.io)

Cuando termine, copia la URL del servicio (p. ej. `https://legado-digital-api.onrender.com`)
y verifica `…/health`.

**2. Frontend en Vercel** — importa este repo:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eddiezalezo/user-name-cc.github.io&root-directory=frontend&project-name=legado-digital&env=NEXT_PUBLIC_API_URL&envDescription=URL%20del%20backend%20en%20Render%20del%20paso%201)

> En la pantalla de Vercel confirma **Root Directory = `frontend`** y pega en
> `NEXT_PUBLIC_API_URL` la URL del backend del paso 1. *Deploy*. Copia tu URL `…vercel.app`.

**3. Cerrar el círculo** — en Render → *Environment* → pon `FRONTEND_ORIGIN` = la URL de
Vercel del paso 2 → se redespliega solo. Listo, ya puedes registrarte y usar el SaaS.

> ¿Por qué no lo dejé yo desplegado? El entorno donde corro tiene la red restringida (no
> alcanza Render/Vercel) y no tengo acceso a tus cuentas. Estos botones lo dejan a un par de
> clics tuyos. El detalle completo y el troubleshooting están abajo.

---

Legado Digital es una app **full-stack** (Next.js con render en servidor + FastAPI + Postgres).
No se puede servir como sitio estático de GitHub Pages. La estrategia pública es:

| Componente | Hosting | URL pública resultante |
|---|---|---|
| Frontend (Next.js) | **Vercel** | `https://<tu-proyecto>.vercel.app` (o tu dominio propio) |
| Backend (FastAPI) | **Render** (Docker) | `https://<tu-servicio>.onrender.com` |
| Base de datos | **Render Postgres** | interna, la consume el backend |

> Sobre "publicar en `user-name-cc.github.io`": GitHub Pages solo sirve HTML/CSS/JS estático,
> así que **no** puede correr este backend ni el SSR de Next. La web pública vivirá en la URL
> de Vercel. Si quieres una URL bonita, conéctale un **dominio propio** en Vercel (Settings →
> Domains). Eso sí es posible; GitHub Pages para esta app, no.

El reto técnico de fondo (front y back en dominios distintos = sesión *cross-site*) ya está
resuelto en el código: la cookie de sesión se emite con `SameSite=None; Secure` y el CORS
permite el origen de Vercel con credenciales. Solo tienes que poner bien las variables.

---

## Orden recomendado (evita el problema del huevo y la gallina)

El backend necesita saber la URL del front (CORS) y el front necesita saber la URL del back
(`NEXT_PUBLIC_API_URL`). Como no las tienes hasta desplegar, hazlo así:

### 1. Backend en Render (primero, para obtener su URL)

1. Sube este repo a GitHub (ya está) y entra a <https://dashboard.render.com>.
2. **New → Blueprint**, conecta el repo. Render lee `render.yaml` y propone crear:
   - el servicio web `legado-digital-api` (Docker, desde `backend/`), y
   - la base de datos `legado-digital-db` (Postgres).
3. Pulsa **Apply**. Render genera solo el `JWT_SECRET` y enlaza `DATABASE_URL`.
4. Deja `FRONTEND_ORIGIN` vacío de momento (lo rellenas en el paso 3).
5. Cuando termine, copia la URL del servicio, p. ej. `https://legado-digital-api.onrender.com`.
   Verifica que responde: `https://...onrender.com/health` → `{"status":"ok"}` y la doc en
   `/docs`.

> **Nota de plan:** el `render.yaml` pide `plan: starter` en el web service porque el **disco
> persistente** (donde se guardan los documentos cifrados subidos) no está disponible en el
> plan `free`. Si solo quieres probar y no te importa que los documentos subidos se borren en
> cada deploy, puedes bajar a `plan: free` y quitar el bloque `disk:` + la var `STORAGE_DIR`.
> El Postgres `free` de Render caduca a los ~30 días.

### 2. Frontend en Vercel

1. Entra a <https://vercel.com> → **Add New → Project** → importa el mismo repo de GitHub.
2. **IMPORTANTE — Root Directory:** en la pantalla de configuración, pon **`frontend`** como
   *Root Directory* (este repo es un monorepo; el Next.js vive en `frontend/`, no en la raíz).
3. Framework: Vercel detecta **Next.js** solo (hay un `frontend/vercel.json` que lo confirma).
4. **Environment Variables** → añade:
   - `NEXT_PUBLIC_API_URL` = la URL del backend del paso 1
     (p. ej. `https://legado-digital-api.onrender.com`, **sin** barra final).
5. **Deploy.** Al terminar copia la URL pública, p. ej. `https://legado-digital.vercel.app`.

### 3. Cerrar el círculo (CORS del backend)

1. Vuelve al servicio en Render → **Environment** → edita `FRONTEND_ORIGIN` y pon la URL de
   Vercel del paso 2 (p. ej. `https://legado-digital.vercel.app`). Sin barra final.
   - Si luego añades dominio propio, ponlos separados por coma:
     `https://legado-digital.vercel.app,https://midominio.com`
2. Guarda → Render redepliega el backend.
3. Listo: abre la URL de Vercel, regístrate, crea la bóveda y prueba el flujo completo.

---

## Variables de entorno por componente

### Backend (Render — ya las pone el `render.yaml`, salvo `FRONTEND_ORIGIN`)

| Variable | Valor en producción | Notas |
|---|---|---|
| `DATABASE_URL` | (enlazada a la DB de Render) | `config.py` normaliza el scheme a psycopg2 |
| `JWT_SECRET` | (generada por Render) | firma de sesión de cuenta, **no** la bóveda |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `43200` | 30 días |
| `COOKIE_SECURE` | `true` | obligatorio sobre HTTPS |
| `COOKIE_SAMESITE` | `none` | obligatorio cross-site (Vercel ↔ Render) |
| `STORAGE_DIR` | `/var/data` | disco persistente montado |
| `FRONTEND_ORIGIN` | URL(s) de Vercel | la rellenas tú; coma-separado si varias |

### Frontend (Vercel)

| Variable | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL del backend en Render | sin barra final |

---

## Comprobaciones rápidas si algo falla

- **401 justo después de hacer login** → casi siempre la cookie. Confirma que el backend
  tiene `COOKIE_SECURE=true` **y** `COOKIE_SAMESITE=none`, y que ambos extremos son HTTPS.
- **Error de CORS en consola del navegador** → `FRONTEND_ORIGIN` en Render no coincide
  EXACTO con el origen de Vercel (ojo a `http` vs `https`, `www`, y la barra final).
- **El backend no arranca / error de DB** → revisa que `DATABASE_URL` esté enlazada; el
  validador de `config.py` convierte `postgres://`/`postgresql://` a `postgresql+psycopg2://`.
- **Los documentos subidos desaparecen tras un deploy** → falta el disco persistente
  (`STORAGE_DIR` apuntando al `mountPath` del disco). El plan `free` no tiene disco.
- **Render free "se duerme"** → el primer request tras inactividad tarda; es normal en free.

---

## Alternativas de hosting del backend

Render es solo una opción cómoda por el blueprint. Cualquier host de contenedores sirve, ya
que hay un `backend/Dockerfile` estándar que escucha en `$PORT`:

- **Railway / Fly.io:** despliega `backend/Dockerfile`, añade un Postgres gestionado y pon las
  mismas variables de la tabla de arriba (incluido un volumen para `STORAGE_DIR`).
- **S3 en vez de disco:** para no depender de disco persistente, queda pendiente migrar
  `LocalDiskStorage` a S3 (las credenciales `S3_*` ya existen en `.env.example`). Ver el TODO
  en `backend/app/services/storage_service.py`.
