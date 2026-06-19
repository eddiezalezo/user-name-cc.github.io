# Legado Digital — Prototipo MVP (Zero-Knowledge)

Organizador de expediente patrimonial digital para LATAM. **No es un testamento ni asesoría
legal**: es una herramienta de organización, inventario y coordinación documental.

> **¿Desplegarlo en público?** Ver [`DEPLOY.md`](./DEPLOY.md): frontend en Vercel + backend
> en Render (Docker) con Postgres. El backend ya viene preparado para sesión cross-site
> (cookie `SameSite=None; Secure` + CORS multi-origen) y hay un `render.yaml` listo.

## Principio de diseño: Zero-Knowledge real

El backend **nunca** ve la master password de la bóveda ni los datos en claro de los
ítems/mensajes/instrucciones. Todo eso se cifra y descifra en el navegador del usuario.

```
master password ──(Argon2id)──► masterKey (KEK)
                                     │
                                     ▼
                         desenvuelve protected_vault_key
                                     │
                                     ▼
                              vaultKey (DEK, 256 bits)
                                     │
                                     ▼
                   cifra/descifra VaultItems, Documents,
                   LegacyInstructions, LegacyMessages
                   (XChaCha20-Poly1305, AEAD)
```

La vaultKey se genera **una sola vez** (aleatoria) al hacer el setup de la bóveda y se
envuelve dos veces:

1. Con una `masterKey` derivada de la master password (Argon2id) → `protected_vault_key`
2. Con una clave derivada de una `recovery key` aleatoria, mostrada una sola vez al usuario
   → `protected_vault_key_recovery`

Esto permite **cambiar la master password sin re-cifrar todos los datos** (solo se
re-envuelve la vaultKey) y permite recuperación de cuenta sin backdoor del servidor.

La password de **cuenta** (login normal, email+password) es algo completamente distinto:
se hashea en el backend (Argon2 vía passlib) y solo sirve para autenticar la sesión HTTP,
nunca se usa para derivar claves de cifrado de la bóveda.

## Estructura

```
/frontend   Next.js 14 (App Router) + TypeScript + Tailwind. Toda la criptografía vive aquí.
/backend    FastAPI + SQLAlchemy 2.0 + Pydantic v2. Solo guarda blobs cifrados + metadatos.
/infra      docker-compose para levantar todo en local.
```

## Levantar en local

```bash
cp .env.example .env
# edita .env si quieres cambiar secrets dummy

docker compose -f infra/docker-compose.yml up --build
```

- Backend (FastAPI): http://localhost:8000  (docs en /docs)
- Frontend (Next.js): http://localhost:3000
- Postgres: localhost:5432

En el primer arranque el backend crea las tablas automáticamente (`Base.metadata.create_all`)
para conveniencia de desarrollo. **TODO**: reemplazar por migraciones Alembic antes de producción.

## Variables de entorno esenciales

Ver `.env.example`. Las importantes:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | conexión a Postgres |
| `JWT_SECRET` | firma de tokens de sesión (cuenta, NO bóveda) — cambiar en prod |
| `JWT_ALGORITHM` / `ACCESS_TOKEN_EXPIRE_MINUTES` | config de sesión |
| `COOKIE_SECURE` | `false` en dev local (HTTP), **`true` obligatorio en producción** (HTTPS) |
| `S3_*` | TODO: credenciales de storage compatible S3 para `VaultDocument` blobs |
| `NEXT_PUBLIC_API_URL` | URL del backend que usa el frontend |

## Flujo de acceso de heredero (Contact → AccessRequest → titular → liberación)

El problema de fondo: el contacto nunca tuvo la vaultKey del titular. ¿Cómo le entregas
datos cifrados con esa clave sin que el servidor pueda leerlos en el camino? Esto **sí está
resuelto** en este prototipo (no es solo un cambio de estado), con el mismo patrón que usa
Bitwarden Emergency Access: criptografía asimétrica (X25519 / `crypto_box_seal`).

1. El titular agrega un `Contact` en `/dashboard/contacts`. El backend genera un
   `invite_token` único para ese contacto.
2. El titular comparte fuera de banda (en persona, no por este sistema) el link
   `/request-access/<token>` con esa persona.
3. El contacto entra a esa página **pública, sin necesitar cuenta**
   (`app/request-access/[token]/page.tsx`). Su navegador genera ahí mismo un par de llaves
   X25519: la **pública** viaja al servidor junto con la solicitud; la **privada** se le
   muestra una sola vez y debe guardarla — nadie más la tiene, ni el titular ni el servidor.
4. El titular revisa la solicitud en `/dashboard/access-requests` y la aprueba o deniega.
5. Si aprueba, puede pulsar "Liberar acceso". Esto ocurre **enteramente en el navegador del
   titular, con la bóveda desbloqueada**: descifra los `VaultItems` e `LegacyInstructions`
   relevantes para ese contacto, arma un paquete JSON, lo cifra con una clave simétrica
   nueva de un solo uso (la "clave de liberación"), y sella esa clave contra la llave
   pública del contacto (`crypto_box_seal`, anónimo — ni el propio titular puede reabrirlo
   después). Sube ambos blobs ya cifrados/sellados a `POST /access-requests/{id}/release`.
6. El contacto vuelve a `/request-access/<token>/status`, pega su llave privada guardada, y
   el navegador hace `crypto_box_seal_open` + descifrado simétrico para mostrarle el
   paquete. El backend nunca tuvo la clave de liberación sin sellar ni el contenido en claro.

**Sigue siendo un TODO de producto** (no de criptografía): qué tan granular es el filtro de
qué se libera (hoy es por `contact.permissions.vault_item_types` si existe, si no se libera
todo el inventario + instrucciones dirigidas a ese contacto), y la ventana de espera /
posibilidad de cancelar antes de liberar.

## Documentos: subida y descarga real (no solo modelado)

El archivo se cifra completo en el navegador (`encryptBytes` con la vaultKey) ANTES de
subirse. El backend lo recibe como un blob de texto opaco vía `multipart/form-data` y lo
guarda en disco local (`backend/storage/`, ver `app/services/storage_service.py`) — la
interfaz está hecha para que cambiar a S3 real sea reemplazar una clase, no tocar routers.
Al bajar un documento, el navegador vuelve a descifrarlo con la vaultKey y dispara la
descarga del archivo original (nombre y tipo MIME también viajan cifrados). Ver
`/dashboard/items/[id]` para la pantalla completa.


- [ ] Revisar y subir parámetros de Argon2id en `frontend/lib/crypto.ts` (memoria/iteraciones)
      según hardware objetivo (hoy usa `crypto_pwhash_OPSLIMIT_MODERATE` / `MEMLIMIT_MODERATE`
      de libsodium como punto de partida razonable, no definitivo).
- [ ] Cifrado/subida de archivos grandes en streaming (hoy `lib/files.ts` y
      `storage_service.py` cargan el archivo completo en memoria; límite duro de 25MB).
      Bien para documentos típicos (PDFs, fotos de pólizas); no para video de mensajes
      póstumos largos.
- [ ] Migrar `LocalDiskStorage` (`backend/app/services/storage_service.py`) a S3 real.
      La interfaz (save/read/delete) ya está separada para que sea un cambio de una clase.
- [ ] Procesador de pagos / billing (plan FREE/PERSONAL/FAMILIAR/PATRIMONIAL ya existe como
      enum en `User.plan`, pero no hay lógica de cobro).
- [ ] MFA (TOTP/WebAuthn) para cuenta y para el flujo de `AccessRequest` de contactos —
      hoy cualquiera con el invite_token o el link de status puede actuar. El link de
      invitación funciona como "algo que tienes"; falta un segundo factor real.
- [ ] Notificaciones reales (email/SMS) cuando se crea una `AccessRequest` o cuando se
      libera acceso — hoy todo es polling manual desde ambos lados.
- [ ] Ventana de espera / cancelación antes de liberar acceso (break-glass real).
- [ ] Granularidad del filtro de qué se libera: hoy es por `contact.permissions.vault_item_types`
      si existe, si no se libera todo. Falta UI para que el titular configure permisos por
      contacto al crearlo/editarlo (el campo `permissions` ya existe en el modelo).
- [ ] Migraciones Alembic en vez de `create_all`.
- [ ] Endpoint de exportación del "Anexo de bienes digitales" (`/legacy/export-annex`) hoy
      regresa JSON estructurado; falta el render a PDF.
- [ ] Code-splitting de `libsodium-wrappers-sumo`: las páginas que usan la bóveda cargan
      ~80KB extra de WASM/JS porque la variante "sumo" (necesaria para Argon2id) es más
      pesada que la estándar. Considerar dynamic import + Suspense para no penalizar
      páginas que no tocan cripto.

## Validación realizada sobre este prototipo (no es solo código sin probar)

- Backend: los 33 archivos Python parsean sin errores de sintaxis, la app FastAPI completa
  importa correctamente (42 endpoints registrados), y todas las relaciones de SQLAlchemy
  (incluida la N:N `instruction_contacts`) configuran sin errores de mapeo.
- **Prueba de integración end-to-end contra PostgreSQL real** (no sqlite — `Contact.permissions`
  y `AuditLog.log_metadata` usan `JSONB`, específico de Postgres): 21 verificaciones, incluyendo
  registro/login, setup de bóveda, subida real de un archivo multipart, descarga y comparación
  byte a byte contra lo subido, borrado real del archivo en disco, el flujo completo de
  `AccessRequest` (creación pública → aprobación → intento de liberar una solicitud no
  aprobada correctamente rechazado con 400 → liberación real → lectura pública del paquete
  liberado), y verificación de que las 5 acciones clave quedan en `audit_logs`.
- Frontend: `tsc --noEmit` y `next build` pasan sin errores sobre las 17 rutas.
- Criptografía simétrica (`lib/crypto.ts`): batería de pruebas funcionales reales que confirma
  setup de bóveda, unlock con password correcta, **rechazo correcto** de password incorrecta,
  recuperación con recovery key, **rechazo correcto** de recovery key incorrecta, que el cambio
  de master password (`rewrap`) preserva la vaultKey original, y cifrado/descifrado de bytes
  binarios arbitrarios (no solo JSON) para el caso de archivos.
- Criptografía asimétrica (liberación de acceso, X25519): batería separada que confirma
  generación de par de llaves del contacto, sellado de una clave de liberación contra la
  pública del contacto, apertura correcta con la llave privada del contacto, y **rechazo
  correcto** cuando se intenta abrir con la llave privada de un contacto distinto.

### Bugs reales encontrados y corregidos durante esta validación

1. La librería `libsodium-wrappers` estándar **no incluye** `crypto_pwhash` (Argon2id) —
   solo la variante `-sumo` lo expone. El prototipo usa `libsodium-wrappers-sumo`.
2. La versión inicial de Next.js (14.2.15) tenía una vulnerabilidad de seguridad conocida
   (CVE-2025-55183/55184/67779); se actualizó a 14.2.35.
3. **La cookie de sesión se creaba con `secure=True` fijo**, lo que la rompe en desarrollo
   local sobre HTTP plano (el mismo docker-compose de este repo) — el navegador (o cualquier
   cliente HTTP correcto) se niega a reenviar una cookie `Secure` fuera de HTTPS. Esto se
   detectó porque la prueba de integración fallaba con 401 justo después de un login exitoso.
   Ahora es configurable vía `COOKIE_SECURE` (`false` en `.env.example` para dev local,
   **debe ponerse en `true` en producción sobre HTTPS**).
4. La defensa contra path traversal en `LocalDiskStorage._resolve()` comparaba una ruta que
   podía ser relativa (`self.root`) contra una ruta siempre absoluta — si `self.root` no
   estaba ya resuelto a absoluto, la comparación fallaba y rechazaba storage_keys válidas.
   Corregido resolviendo `self.root` a absoluto en `__init__`.

## Lo que este prototipo deliberadamente NO hace

- No guarda credenciales bancarias completas ni hace login automático en bancos.
- No sustituye un testamento: ver aviso legal en `frontend/app/page.tsx`.
- No tiene backdoor: si el usuario pierde su master password Y su recovery key, los
  datos cifrados son irrecuperables. Esto es **intencional** (zero-knowledge real).
