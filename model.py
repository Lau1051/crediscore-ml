"""
model.py — Lógica ML y funciones financieras
Dataset cargado desde Google Drive local montado.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import os

# ─── RUTA DEL DATASET EN GOOGLE DRIVE ────────────────────────────────────────
# Ajusta esta ruta según donde tengas montado tu Google Drive
# Windows: r"G:\Mi unidad\Colab Notebooks\ProyectoIA\Datos.xlsx"
# Mac/Linux con google-drive-ocamlfuse o rclone: "/mnt/gdrive/ProyectoIA/Datos.xlsx"
RUTA_EXCEL = os.path.join(os.path.dirname(__file__), "Datos.xlsx")
SHEET_NAME = "MOCK_DATA"

# ─── ESTADO GLOBAL ────────────────────────────────────────────────────────────
escalador    = StandardScaler()
mejor_modelo = None
modelo_stats = {}

# ─── ENTRENAMIENTO ────────────────────────────────────────────────────────────

def entrenar() -> dict:
    global escalador, mejor_modelo, modelo_stats

    df = pd.read_excel(RUTA_EXCEL, sheet_name=SHEET_NAME)

    x = np.column_stack([
        df["Gastos"].values,
        df["Ingresos"].values,
        df["Deuda"].values,
        df["Tiempo"].values,
    ])
    y = df["PagaDeuda"].astype(int).values

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.3, random_state=42
    )

    x_train_lr = escalador.fit_transform(x_train)
    x_test_lr  = escalador.transform(x_test)

    lr = LogisticRegression(max_iter=1000, random_state=42)
    lr.fit(x_train_lr, y_train)

    mejor_modelo = lr

    pipeline_lr = Pipeline([("scaler", StandardScaler()), ("model", LogisticRegression(max_iter=1000, random_state=42))])
    cv_lr = cross_val_score(pipeline_lr, x, y, cv=5)

    modelo_stats = {
        "total_registros": len(x),
        "pagan":    int(sum(y)),
        "no_pagan": int(len(y) - sum(y)),
        "accuracy": {
            "logistic_regression": round(lr.score(x_test_lr, y_test) * 100, 2),
        },
        "cross_val": {
            "logistic_regression": round(cv_lr.mean() * 100, 2),
        },
        "modelo_seleccionado": "Logistic Regression",
    }

    return modelo_stats


# ─── FUNCIONES FINANCIERAS ────────────────────────────────────────────────────

def clasificar_gastos(gastos, ingresos):
    r = gastos / ingresos
    return "Bajo" if r < 0.4 else ("Medio" if r < 0.7 else "Alto")

def calcular_ratios(ingreso, gastos, deuda):
    return ingreso - gastos, deuda / ingreso

def nivel_riesgo_no_paga(prob):
    return "Alto" if prob > 0.7 else ("Medio" if prob > 0.4 else "Bajo")

def max_endeudamiento(ingreso):
    return ingreso * 0.3

def calcular_score(ratio_gastos, ratio_deuda, capacidad, prob_no_paga):
    score = 100
    if ratio_gastos > 0.85: score -= 35
    elif ratio_gastos > 0.7: score -= 25
    elif ratio_gastos > 0.4: score -= 10
    if ratio_deuda > 2:  score -= 40
    elif ratio_deuda > 1: score -= 30
    if capacidad < 0: score -= 35
    if prob_no_paga > 0.7:  score -= 20
    elif prob_no_paga > 0.5: score -= 10
    return max(score, 0)

def clasificar_semaforo(score):
    return "BAJO RIESGO" if score >= 75 else ("RIESGO MEDIO" if score >= 50 else "ALTO RIESGO")

def segmentar_cliente(score):
    if score >= 85: return "Cliente Premium"
    elif score >= 70: return "Cliente Bueno"
    elif score >= 50: return "Cliente Riesgo Medio"
    return "Cliente de Alto Riesgo"

def generar_explicacion(ratio_gastos, ratio_deuda, capacidad, prob_no_paga):
    causas = []
    if ratio_gastos > 0.7:  causas.append("alto nivel de gastos")
    if ratio_deuda > 1:     causas.append("nivel de deuda elevado")
    if capacidad < 0:       causas.append("falta de capacidad de pago")
    if prob_no_paga > 0.6:  causas.append("alta probabilidad de incumplimiento")
    return ", ".join(causas) if causas else "perfil financiero estable"

def proyeccion_ahorro(disponible):
    a = max(disponible, 0)
    return a * 3, a * 6, a * 12

def calcular_tiempo_adecuado(ingreso, gastos, deuda):
    disponible    = ingreso - gastos
    cuota_maxima  = disponible * 0.30
    margen_minimo = ingreso * 0.10
    for meses in range(6, 361, 6):
        cuota     = deuda / meses
        excedente = disponible - cuota
        if cuota <= cuota_maxima and excedente >= margen_minimo:
            return meses
    return 360

def generar_recomendacion(segmento, score, capacidad, deuda, tiempo,
                           ahorro_3, ahorro_6, ahorro_12, explicacion):
    if score < 50:
        return (
            f"Eres un {segmento}. No es recomendable asumir esta deuda ahora. "
            f"Tu perfil presenta: {explicacion}. "
            f"Reduce gastos un 10-20% y ahorra 3-6 meses "
            f"(entre ${ahorro_3:,.0f} y ${ahorro_6:,.0f}) para usarlo como cuota inicial."
        )
    elif score < 70:
        return (
            f"Eres un {segmento}. Puedes asumir la deuda, pero con riesgo moderado. "
            f"Reduce gastos innecesarios y mantén estabilidad en ingresos. "
            f"En 6 meses podrías ahorrar ${ahorro_6:,.0f} como respaldo."
        )
    return (
        f"Eres un {segmento}. Tu perfil es sólido para la deuda de ${deuda:,.0f} "
        f"en {tiempo} meses. En 12 meses podrías acumular ${ahorro_12:,.0f} adicionales."
    )


# ─── PREDICCIÓN PRINCIPAL ─────────────────────────────────────────────────────

def analizar_perfil(gastos: float, ingreso: float, deuda: float,
                    tiempo: int = None) -> dict:
    if mejor_modelo is None:
        raise RuntimeError("Modelo no entrenado. Presiona 'Entrenar modelo' primero.")

    tiempo_calculado = not tiempo
    if tiempo_calculado:
        tiempo = calcular_tiempo_adecuado(ingreso, gastos, deuda)

    datos_escalados = escalador.transform([[gastos, ingreso, deuda, tiempo]])
    probabilidad    = mejor_modelo.predict_proba(datos_escalados)[0]

    disponible   = ingreso - gastos
    pago_mensual = deuda / tiempo
    capacidad    = disponible - pago_mensual
    ratio_gastos = gastos / ingreso
    _, ratio_deuda = calcular_ratios(ingreso, gastos, deuda)
    ahorro_3, ahorro_6, ahorro_12 = proyeccion_ahorro(disponible)

    score    = calcular_score(ratio_gastos, ratio_deuda, capacidad, probabilidad[0])
    semaforo = clasificar_semaforo(score)
    segmento = segmentar_cliente(score)
    explicacion = generar_explicacion(ratio_gastos, ratio_deuda, capacidad, probabilidad[0])
    aprobado = score >= 50 and capacidad > 0

    return {
        "perfil": {
            "ingreso": ingreso, "gastos": gastos,
            "deuda": deuda, "tiempo": tiempo,
            "tiempo_calculado": tiempo_calculado,
        },
        "capacidad_pago": {
            "disponible": disponible,
            "pago_mensual": pago_mensual,
            "excedente": capacidad,
        },
        "indicadores": {
            "nivel_gasto":       clasificar_gastos(gastos, ingreso),
            "ratio_gastos_pct":  round(ratio_gastos * 100, 2),
            "ratio_deuda":       round(ratio_deuda, 4),
            "riesgo_no_paga":    nivel_riesgo_no_paga(probabilidad[0]),
            "max_endeudamiento": max_endeudamiento(ingreso),
        },
        "probabilidades": {
            "no_paga": round(float(probabilidad[0]) * 100, 2),
            "si_paga": round(float(probabilidad[1]) * 100, 2),
        },
        "score": {
            "valor": score, "semaforo": semaforo, "segmento": segmento,
        },
        "diagnostico": {
            "cubre_cuota":     capacidad > 0,
            "nivel_deuda_txt": "Manejable" if ratio_deuda <= 1 else ("Elevada" if ratio_deuda <= 2 else "Crítica"),
            "meses_equiv":     round(deuda / ingreso, 2),
            "explicacion":     explicacion,
        },
        "proyeccion_ahorro": {
            "mensual":    max(disponible, 0),
            "tres_meses": ahorro_3,
            "seis_meses": ahorro_6,
            "doce_meses": ahorro_12,
        },
        "recomendacion": generar_recomendacion(
            segmento, score, capacidad, deuda, tiempo,
            ahorro_3, ahorro_6, ahorro_12, explicacion
        ),
        "decision": {
            "aprobado": aprobado,
            "estado":   "APROBADO" if aprobado else "RECHAZADO",
        },
    }
