"""
main.py — API REST con FastAPI
El dataset vive en Google Drive (ruta configurada en model.py).
El modelo se entrena bajo demanda con POST /entrenar.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import model as m

app = FastAPI(
    title="FinScore API",
    description="Analizador de riesgo financiero — dataset desde Google Drive",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class PerfilRequest(BaseModel):
    ingreso: float = Field(..., gt=0, description="Ingresos mensuales")
    gastos:  float = Field(..., gt=0, description="Gastos mensuales")
    deuda:   float = Field(..., ge=0, description="Monto total de la deuda")
    tiempo:  Optional[int] = Field(None, ge=1, le=360, description="Plazo en meses (opcional)")

# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "modelo_entrenado": m.mejor_modelo is not None,
        "ruta_dataset": m.RUTA_EXCEL,
    }

@app.post("/entrenar")
def entrenar():
    """
    Carga el Excel desde Google Drive y entrena el modelo.
    Llama a este endpoint una vez antes de analizar perfiles.
    """
    try:
        stats = m.entrenar()
        return {"mensaje": "Modelo entrenado correctamente", "estadisticas": stats}
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró el archivo en: {m.RUTA_EXCEL}. "
                   f"Verifica que Google Drive esté montado y la ruta sea correcta."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/modelo/stats")
def get_stats():
    if m.mejor_modelo is None:
        raise HTTPException(status_code=400, detail="Modelo no entrenado aún.")
    return m.modelo_stats

@app.post("/analizar")
def analizar(req: PerfilRequest):
    """
    Recibe el perfil del usuario y retorna el análisis completo del modelo.
    """
    if m.mejor_modelo is None:
        raise HTTPException(
            status_code=400,
            detail="El modelo no está entrenado. Presiona 'Entrenar modelo' en el frontend."
        )
    try:
        return m.analizar_perfil(
            gastos=req.gastos,
            ingreso=req.ingreso,
            deuda=req.deuda,
            tiempo=req.tiempo,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
