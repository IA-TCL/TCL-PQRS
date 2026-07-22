# PQRS — Instrucciones de despliegue del backend PHP

Este documento es para que la IA (o la persona) que administra el hosting de
`tclasesores.com` sepa exactamente qué pasó, qué se preparó, y qué hacer.
Está escrito para poder actuar sobre él directamente, sin necesitar más
contexto que el que está aquí.

## 1. Resumen del problema (causa raíz confirmada)

El formulario PQRS en `https://tclasesores.com/pqrs/` no está generando
solicitudes. Se investigó a fondo (logs de Cloud Run de 90 días + pruebas
directas) y se confirmó lo siguiente:

- El archivo `script.js` que está hoy en `/pqrsia/` llama a `fetch('submit.php')`
  para enviar el formulario (esto está bien, **no hay que tocar `script.js`**).
- `submit.php` (el archivo PHP que está hoy en `/pqrsia/submit.php`) internamente
  depende de un backend externo en Render (`tcl-pqrs.onrender.com`) que **ya no
  existe** — la conexión se cuelga indefinidamente sin responder.
- Por eso todo envío real de un usuario termina en el mensaje genérico
  `"No se pudo registrar la solicitud. Intenta más tarde."`
- Esto no tiene relación con Cloud Run ni con CORS/CSP — esos ya se revisaron
  y están bien configurados, simplemente `submit.php` nunca los usa.

## 2. La solución

Se reescribió `submit.php` en PHP puro, **sin depender de ningún servicio
externo excepto Airtable directamente** (la misma base de datos donde ya se
guardan las solicitudes). Ya se probó de punta a punta:

- Las 6 validaciones de campos (tipo, autorización, nombres/apellidos,
  celular, correo, descripción) — mismos mensajes de error que la versión
  Python de referencia (`server.py`, en el repo `IA-TCL/TCL-PQRS`).
- Límite de 5 solicitudes/hora **por IP real** del visitante (usa el header
  `X-Forwarded-For` si existe, si no `REMOTE_ADDR`).
- Escritura real en Airtable, incluyendo tildes y caracteres especiales en
  español (probado con texto real: "José, María, certificación").
- Subida de adjuntos opcionales (PDF/Word/imágenes, máx. 25 MB) vía
  tmpfiles.org → Airtable, igual que la versión Python.

## 3. Archivos a desplegar en `/pqrsia/`

Reemplazar/agregar estos 3 elementos, todos incluidos junto a este `.md`:

| Archivo | Acción | Contenido |
|---|---|---|
| `submit.php` | **Reemplazar** el que existe hoy | Nueva lógica completa, sin Render |
| `config.php` | **Reemplazar/crear** | Constantes `AIRTABLE_TOKEN`, `AIRTABLE_BASE`, `AIRTABLE_TABLE` — ya viene con los valores reales, tomados directamente de la configuración actual del servicio en Cloud Run (misma base de Airtable que ya se usa) |
| `rate_limit/` (carpeta) | **Crear** si no existe | Contiene `.htaccess` que bloquea el acceso directo. Se llena sola con archivos `.json` por IP a medida que se usa el formulario — no requiere mantenimiento |

**No tocar:** `script.js`, `styles.css`, `embed.php`, `.htaccess` (el de seguridad/CSP), `resize-emitter.js`. Ninguno de esos necesita cambios para esta corrección.

## 4. Verificación después de subir

Desde cualquier terminal con acceso a internet:

```bash
# 1. Confirmar que submit.php responde (debe rechazar GET con 405)
curl -I https://tclasesores.com/pqrsia/submit.php

# 2. Enviar una solicitud de prueba real (genera un registro real en Airtable
#    marcado como prueba — se puede borrar después desde Airtable)
curl -X POST https://tclasesores.com/pqrsia/submit.php \
  -F "nombres=PRUEBA-DEPLOY" -F "apellidos=NO-RESPONDER" \
  -F "correo=prueba@tclasesores.com" -F "celular=3000000000" \
  -F "tipo=Sugerencia" \
  -F "descripcion=[PRUEBA - IGNORAR] Verificacion de despliegue de submit.php nuevo." \
  -F "autorizacion=si"
```

Respuesta esperada:
```json
{"success":true,"message":"Solicitud enviada correctamente.","radicado":"TCL-..."}
```

Si en cambio da `{"success":false,"message":"No se pudo registrar la solicitud..."}`,
revisar el log de errores de PHP del servidor (la línea con `error_log()` en
`submit.php` deja el detalle exacto de qué respondió Airtable).

Después, confirmar en Airtable (base `Pqrs`) que el registro de prueba
`PRUEBA-DEPLOY` aparece, y borrarlo.

## 5. Contexto adicional (por si hace falta profundizar)

- Repo de referencia (arquitectura Python/Cloud Run, ya migrada y funcionando
  de forma independiente): `https://github.com/IA-TCL/TCL-PQRS`
- El token de Airtable en `config.php` es el mismo que usa el servicio
  `tcl-pqrs` en Cloud Run (proyecto GCP `formulario-499821`) — si se rota ese
  token en Airtable, hay que actualizarlo en **ambos** lugares.
- `wp-config.php` (credenciales de WordPress) es un archivo completamente
  distinto y no tiene relación con este backend — no confundirlos.
