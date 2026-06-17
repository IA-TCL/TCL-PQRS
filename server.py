import os
import secrets
import datetime
from urllib.parse import quote

import requests
from fastapi import FastAPI, Form
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
):
    tipos_validos = ["Petición", "Queja", "Reclamo", "Sugerencia", "Felicitación"]
    if tipo not in tipos_validos:
        return JSONResponse({"success": False, "message": "Tipo de PQRS no válido."}, status_code=400)

    if autorizacion != "si":
        return JSONResponse({"success": False, "message": "Debes aceptar la política de privacidad."}, status_code=400)

    radicado = f"TCL-{datetime.date.today().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

    fields = {
        "Nombres":            nombres,
        "Apellidos":          apellidos,
        "Correo electronico": correo,
        "Celular":            celular,
        "Tipo PQRS":          tipo,
        "Descripción":        descripcion,
        "Radicado":           radicado,
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

    return JSONResponse({"success": True, "message": "Solicitud enviada correctamente.", "radicado": radicado})
