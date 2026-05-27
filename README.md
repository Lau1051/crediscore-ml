# 💳 CrediScore — Analizador de Riesgo Financiero con Machine Learning

> Sistema inteligente de análisis crediticio que predice la capacidad de pago de una persona, genera un score financiero personalizado y entrega recomendaciones accionables a través de una interfaz web profesional.

---

## 🧭 Resumen Ejecutivo

**CrediScore** es una solución de inteligencia artificial orientada a democratizar el análisis crediticio. Muchas personas no tienen acceso a las herramientas que usan bancos y entidades financieras para evaluar si pueden asumir una deuda de forma responsable.

Con solo ingresar sus **ingresos, gastos y el monto a financiar**, el sistema:

- Predice la probabilidad de pago usando un modelo de **Regresión Logística** entrenado con 1.150 perfiles financieros
- Calcula un **score de riesgo de 0 a 100** con semáforo visual (bajo / medio / alto)
- Determina el **plazo óptimo de pago** automáticamente
- Emite una decisión **APROBADO / RECHAZADO** con justificación clara
- Genera una **recomendación personalizada** con pasos concretos

---

## 📌 Problema y Solución

El usuario común no tiene acceso a las herramientas que usan bancos para evaluar riesgo crediticio. CrediScore llena ese vacío: dado un perfil financiero básico, el sistema analiza la situación, predice el comportamiento de pago y guía al usuario con información clara y accionable — sin jerga financiera.

---

## 🧰 Stack Tecnológico

### Backend — Python

| Librería | Uso |
|---|---|
| `FastAPI` | Framework para la API REST |
| `uvicorn` | Servidor ASGI |
| `scikit-learn` | Regresión Logística, StandardScaler, validación cruzada |
| `pandas` | Carga y manipulación del dataset |
| `numpy` | Operaciones matriciales |
| `openpyxl` | Lectura de archivos `.xlsx` |
| `pydantic` | Validación de datos de entrada |

### Frontend — Web

| Recurso | Uso |
|---|---|
| HTML5 + CSS3 | Estructura y estilos |
| JavaScript (Vanilla) | Lógica de interfaz y llamadas a la API |
| Chart.js 4.4.1 | Gauge de score, barras de probabilidad, donut, proyección de ahorro |
| Google Fonts | Playfair Display, Epilogue, JetBrains Mono |

---

## 🗂️ Dataset

Dataset sintético que simula perfiles financieros reales de Colombia, almacenado en `Datos.xlsx` (hoja: `MOCK_DATA`).

| Columna | Descripción | Rango |
|---|---|---|
| `Gastos` | Gastos mensuales (COP) | $200.000 – $181.000.000 |
| `Ingresos` | Ingresos mensuales (COP) | $511.000 – $199.000.000 |
| `Deuda` | Monto total a financiar (COP) | $5.373 – $199.000.000 |
| `Tiempo` | Plazo en meses | 3 – 60 meses |
| `PagaDeuda` | Variable objetivo (1 = paga, 0 = no paga) | Binaria |

Los perfiles cubren distintos estratos económicos para que el modelo aprenda a distinguir clientes de bajo, medio y alto riesgo.

**Distribución del dataset:**
- Total de registros: **1.150 perfiles**
- Sí pagan (clase 1): **675 → 58.7%**
- No pagan (clase 0): **475 → 41.3%**
- División: **70% entrenamiento / 30% prueba** (805 train — 345 test)

---

## 🤖 Modelo de Machine Learning

### Regresión Logística (`LogisticRegression`)

Modelo de clasificación binaria supervisada que predice la probabilidad de que una persona pague o no pague su deuda, entrenado sobre 4 variables: `Gastos`, `Ingresos`, `Deuda` y `Tiempo`. Los datos se normalizan con `StandardScaler` antes del entrenamiento (`max_iter=1000`, `random_state=42`).

**¿Por qué este modelo?**

Se evaluaron tres algoritmos de clasificación antes de tomar la decisión:

| Modelo | Accuracy (test) | Accuracy (CV=5) | Comportamiento |
|---|---|---|---|
| Decision Tree | Alto | Bajo | Sobreajuste — caída fuerte en validación cruzada |
| Random Forest | Alto | Bajo | Sobreajuste — caída fuerte en validación cruzada |
| **Logistic Regression** | **72.75%** | **68.09%** | **Estable — consistente entre test y CV** |

Decision Tree y Random Forest obtenían accuracy altas en el conjunto de prueba, pero al aplicar validación cruzada de 5 pliegues el porcentaje caía considerablemente, lo que indica sobreajuste al conjunto de entrenamiento. La Regresión Logística fue el modelo más estable y confiable entre ambas métricas, por lo que se seleccionó como modelo definitivo.

Razones adicionales para su elección:

1. **Interpretabilidad** — entrega probabilidades directas (ej. "78% de probabilidad de pagar"), fundamentales para explicar una decisión crediticia
2. **Adecuación al problema** — clasificación binaria es exactamente su caso de uso
3. **Generalización** — con 1.150 registros y 4 features, un modelo simple generaliza mejor que uno complejo
4. **Ligereza** — se serializa y sirve en tiempo real sin latencia apreciable

---

## 📈 Métricas de Desempeño

| Métrica | Valor |
|---|---|
| Accuracy en test set | **72.75%** |
| Accuracy validación cruzada (CV=5) | **68.09%** promedio |
| Desviación estándar CV | ±10.74% |

**Reporte de clasificación — 345 registros de prueba:**

| Clase | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| No Paga (0) | 0.68 | 0.56 | 0.61 | 133 |
| Sí Paga (1) | 0.75 | 0.83 | 0.79 | 212 |
| **Promedio ponderado** | **0.72** | **0.73** | **0.72** | **345** |

> El modelo identifica mejor a quienes sí pagan (recall 83%), siendo conservador al aprobar — comportamiento deseable en un contexto crediticio.

---

## 🔮 Predicciones y Motor de Decisión

Para cada perfil, el modelo produce probabilidades via `predict_proba()` que alimentan un motor de reglas:

```
predict_proba()
      ↓
  Score 0–100  ──→  Semáforo: BAJO / MEDIO / ALTO riesgo
      ↓
  Decisión: APROBADO (score ≥ 50 y excedente > 0) / RECHAZADO
      ↓
  Indicadores: cuota mensual, excedente, ratio de gastos, nivel de deuda
      ↓
  Proyección de ahorro: 3, 6 y 12 meses
      ↓
  Recomendación personalizada con pasos concretos
```

**Reglas generadas a partir de las predicciones:**

| Condición | Comportamiento |
|---|---|
| `score ≥ 70` | Banner verde — APROBADO — recomendación de crecimiento |
| `50 ≤ score < 70` | Banner neutro — APROBADO con advertencias — reducir gastos |
| `score < 50` | Banner rojo — RECHAZADO — recomendación de ahorro previo |
| `prob_no_paga > 0.7` | Penalización de -20 pts al score |
| `excedente < 0` | Rechazo automático sin importar el score |
| `tiempo = null` | Sistema calcula plazo óptimo iterando de 6 en 6 meses (cuota ≤ 30% del disponible) |

---

## 🖥️ Arquitectura del Sistema

El sistema opera con dos componentes desacoplados:

### Backend — `main.py` + `model.py`

**`model.py`** — lógica ML y financiera: entrenamiento, validación cruzada, score, semáforo, segmentación de cliente, proyección de ahorro, cálculo de plazo óptimo y generación de recomendación.

**`main.py`** — API REST con FastAPI:

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del modelo |
| `POST` | `/entrenar` | Carga dataset y entrena el modelo |
| `POST` | `/analizar` | Recibe perfil y retorna análisis completo |

### Frontend — `index.html` + `styles.css` + `app.js`

Interfaz de tres secciones:

1. **Hero / Landing** — presentación del producto con tarjetas y características
2. **Cómo funciona** — grid de 6 tarjetas explicativas
3. **Analizador** — flujo de dos pasos: entrenar modelo → ingresar perfil → ver resultados

**Visualizaciones en el panel de resultados:**
- Banner APROBADO / RECHAZADO con semáforo de riesgo
- Cards de cuota mensual, disponible y excedente
- Gauge de score 0–100
- Gráfica de probabilidades (sí paga vs. no paga)
- Indicadores clave con barras de progreso
- Donut de composición del ingreso
- Proyección de ahorro a 3, 6 y 12 meses
- Recomendación personalizada

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Requisitos previos

- Python 3.9+
- Navegador moderno (Chrome, Firefox, Edge)

### 2. Instalar dependencias

```bash
pip install fastapi uvicorn scikit-learn pandas openpyxl numpy
```

### 3. Iniciar el backend

```bash
# Navegar a la carpeta del proyecto
cd "ruta/del/proyecto"

# Levantar la API
uvicorn main:app --reload --port 8000
```

La API queda disponible en `http://localhost:8000`. Puedes verificarla en `http://localhost:8000/health`.

### 4. Abrir el frontend

Abre el archivo `index.html` directamente en el navegador (doble clic). No requiere servidor web.

### 5. Usar el sistema

1. Clic en **"Entrenar modelo"** — carga los 1.150 perfiles y entrena (~2 segundos)
2. Ingresa tus datos: ingresos, gastos, monto de la deuda y plazo (opcional)
3. Clic en **"Analizar"** — el sistema retorna el análisis completo

---

## 📁 Estructura del Proyecto

```
Machine Learning/
├── index.html       # Estructura HTML de la interfaz
├── styles.css       # Estilos y diseño visual
├── app.js           # Lógica del frontend (Chart.js, llamadas a la API)
├── main.py          # API REST con FastAPI
├── model.py         # Lógica ML y funciones financieras
└── Datos.xlsx       # Dataset con 1.150 perfiles (hoja: MOCK_DATA)
```

---

## 🌐 Despliegue / Demo

| Recurso | Link |
|---|---|
| 📁 Repositorio GitHub | [github.com/lau1051/crediscore-ml](https://github.com/lau1051/crediscore-ml) |
| 🌍 Demo Web | [lau1051.github.io/crediscore-ml](https://lau1051.github.io/crediscore-ml/) |
| ⚙️ Backend API | [crediscore-ml.onrender.com](https://crediscore-ml.onrender.com) |
| 🎬 Video en YouTube | _próximamente_ |

---

---

*Proyecto desarrollado para la materia de Inteligencia Artificial · 2026*
