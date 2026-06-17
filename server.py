import os
import secrets
import datetime
from urllib.parse import quote
from typing import Optional

import requests
from fastapi import FastAPI, Form, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

AIRTABLE_TOKEN = os.getenv("AIRTABLE_TOKEN")
AIRTABLE_BASE  = os.getenv("AIRTABLE_BASE",  "appbi0qh1QhTzFVg0")
AIRTABLE_TABLE = os.getenv("AIRTABLE_TABLE", "Pqrs")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")


@app.get("/")
async def health():
    return {"status": "ok"}


@app.post("/pqrs")
async def submit_pqrs(
    nombres:      str = Form(...),
    apellidos:    str = Form(...),
    correo:       str = Form(...),
    celular:      str = Form(...),
    tipo:         str = Form(...),
    descripcion:  str = Form(...),
    autorizacion: str = Form(default="no"),
    adjunto:      Optional[UploadFile] = File(default=None),
):
    tipos_validos = ["Petición", "Queja", "Reclamo", "Sugerencia", "Felicitación"]
    if tipo not in tipos_validos:
        return JSONResponse({"success": False, "message": "Tipo de PQRS no válido."}, status_code=400)

    if autorizacion != "si":
        return JSONResponse({"success": False, "message": "Debes aceptar la política de privacidad."}, status_code=400)

    radicado = f"TCL-{datetime.date.today().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    fields = {
        "Nombres":                     nombres,
        "Apellidos":                   apellidos,
        "Correo electronico":          correo,
        "Celular":                     celular,
        "Tipo PQRS":                   tipo,
        "Descripción":                 descripcion,
        "Radicado":                    radicado,
        "Confirmación y autorización": "Acepto y autorizo",
    }

    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{quote(AIRTABLE_TABLE)}"
    headers = {
        "Authorization": f"Bearer {AIRTABLE_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(url, json={"fields": fields}, headers=headers, timeout=10)
    except Exception:
        return JSONResponse({"success": False, "message": "Error de conexión. Intenta más tarde."}, status_code=500)

    if resp.status_code not in (200, 201):
        detail = ""
        try:
            detail = resp.json().get("error", {}).get("message", "")
        except Exception:
            pass
        msg = f"Airtable error {resp.status_code}: {detail}" if detail else f"Airtable error {resp.status_code}"
        return JSONResponse({"success": False, "message": msg}, status_code=500)

    record_id = resp.json().get("id")

    # Subir adjunto si existe
    if adjunto and adjunto.filename and record_id:
        try:
            file_bytes = await adjunto.read()
            ctype = adjunto.content_type or "application/octet-stream"

            # 1. Subir a tmpfiles.org para obtener una URL temporal
            tmp = requests.post(
                "https://tmpfiles.org/api/v1/upload",
                files={"file": (adjunto.filename, file_bytes, ctype)},
                timeout=15,
            )
            file_url = tmp.json().get("data", {}).get("url", "")
            # Convertir URL de vista a URL de descarga directa
            file_url = file_url.replace("tmpfiles.org/", "tmpfiles.org/dl/")

            if file_url:
                # 2. PATCH del registro con la URL — Airtable la descarga y almacena permanentemente
                patch_url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{quote(AIRTABLE_TABLE)}/{record_id}"
                requests.patch(
                    patch_url,
                    json={"fields": {"Adjuntar (opcional)": [{"url": file_url, "filename": adjunto.filename}]}},
                    headers=headers,
                    timeout=10,
                )
        except Exception:
            pass  # El registro ya quedó guardado; el adjunto es opcional

    # Enviar correo de confirmación al usuario
    if RESEND_API_KEY:
        try:
            requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "TCL Asesores PQRS <pqrs@tclasesores.com>",
                    "to": [correo],
                    "subject": f"Solicitud radicada exitosamente – {radicado}",
                    "html": f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <!-- Header -->
        <tr>
          <td style="background:#1a3a2e;padding:28px 36px;text-align:center">
            <p style="margin:0;color:#a8c5b5;font-size:13px;letter-spacing:2px;text-transform:uppercase">TCL Asesores</p>
            <p style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700">Solicitud Radicada</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 36px">
            <p style="margin:0 0 8px;color:#333;font-size:15px">Hola, <strong>{nombres} {apellidos}</strong></p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6">
              Hemos recibido tu solicitud correctamente. A continuación el resumen:
            </p>
            <!-- Radicado destacado -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#f0f7f4;border-left:4px solid #1a3a2e;border-radius:4px;padding:16px 20px">
                  <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px">Número de radicado</p>
                  <p style="margin:4px 0 0;color:#1a3a2e;font-size:20px;font-weight:700;letter-spacing:1px">{radicado}</p>
                </td>
              </tr>
            </table>
            <!-- Detalle -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;margin-bottom:24px">
              <tr style="background:#fafafa">
                <td style="padding:10px 16px;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:40%;border-bottom:1px solid #e8e8e8">Tipo</td>
                <td style="padding:10px 16px;color:#333;font-size:14px;border-bottom:1px solid #e8e8e8">{tipo}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:40%;border-bottom:1px solid #e8e8e8">Correo</td>
                <td style="padding:10px 16px;color:#333;font-size:14px;border-bottom:1px solid #e8e8e8">{correo}</td>
              </tr>
              <tr style="background:#fafafa">
                <td style="padding:10px 16px;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:40%">Celular</td>
                <td style="padding:10px 16px;color:#333;font-size:14px">{celular}</td>
              </tr>
            </table>
            <p style="margin:0;color:#555;font-size:13px;line-height:1.6">
              Nuestro equipo revisará tu solicitud y te contactará en los próximos días hábiles.
              Guarda este número de radicado para hacer seguimiento.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 36px;text-align:center">
            <p style="margin:0;color:#aaa;font-size:12px">TCL Asesores · ia@tclasesores.com</p>
            <p style="margin:4px 0 0;color:#ccc;font-size:11px">Este es un correo automático, por favor no responder.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""",
                },
                timeout=10,
            )
        except Exception:
            pass  # El radicado ya quedó guardado; el correo es secundario

    return JSONResponse({"success": True, "message": "Solicitud enviada correctamente.", "radicado": radicado})
