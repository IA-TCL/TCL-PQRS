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
AIRTABLE_BASE  = os.getenv("AIRTABLE_BASE",  "appLVSEg1Y2zIwvuM")
AIRTABLE_TABLE = os.getenv("AIRTABLE_TABLE", "Pqrs")


@app.get("/")
async def health():
    return {"status": "ok"}


@app.post("/pqrs")
async def submit_pqrs(
    nombres:          str = Form(...),
    apellidos:        str = Form(...),
    correo:           str = Form(...),
    celular:          str = Form(...),
    tipo:             str = Form(...),
    descripcion:      str = Form(...),
    autorizacion:     str = Form(default="no"),
    adjunto:          Optional[UploadFile] = File(default=None),
):
    tipos_validos = ["Petición", "Queja", "Reclamo", "Sugerencia", "Felicitación"]
    if tipo not in tipos_validos:
        return JSONResponse({"success": False, "message": "Tipo de PQRS no válido."}, status_code=400)

    if autorizacion != "si":
        return JSONResponse({"success": False, "message": "Debes aceptar la política de privacidad."}, status_code=400)

    TIPOS_PERMITIDOS = {'.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'}
    MAX_FILE_SIZE    = 25 * 1024 * 1024  # 25 MB
    if adjunto and adjunto.filename:
        ext = os.path.splitext(adjunto.filename)[1].lower()
        if ext not in TIPOS_PERMITIDOS:
            return JSONResponse({"success": False, "message": "Tipo de archivo no permitido. Solo se aceptan PDF, Word e imágenes."}, status_code=400)
        file_bytes = await adjunto.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            return JSONResponse({"success": False, "message": "El archivo adjunto no puede superar los 25 MB."}, status_code=400)
    else:
        file_bytes = None

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
    if file_bytes and adjunto and adjunto.filename and record_id:
        try:
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

    return JSONResponse({"success": True, "message": "Solicitud enviada correctamente.", "radicado": radicado})
