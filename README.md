# 💳 CrediScore — Analizador de Riesgo Financiero con Machine Learning

> Sistema inteligente que predice la capacidad de pago de una persona mediante un modelo de Machine Learning, entregando un score financiero, decisión crediticia y recomendaciones personalizadas a través de una interfaz web profesional.

---

## 📌 Problema o necesidad que quisimos solucionar

Muchas personas no saben con certeza si pueden asumir una deuda sin comprometer su estabilidad financiera. Bancos y entidades crediticias tienen herramientas complejas para esto, pero el usuario común no tiene acceso a ese análisis.

**CrediScore** resuelve ese problema: dada la información financiera básica de una persona (ingresos, gastos y monto de la deuda), el sistema predice si ese perfil tiene capacidad de pago, entrega un score de 0 a 100, calcula el plazo ideal de la deuda y genera una recomendación personalizada.

---

## 🧰 Librerías, frameworks y recursos utilizados

### Backend (Python)
| Librería | Uso |
|---|---|
| `FastAPI` | Framework para construir la API REST |
| `uvicorn` | Servidor ASGI para correr la API |
| `scikit-learn` | Modelo de Machine Learning (Regresión Logística, escalado, validación cruzada) |
| `pandas` | Carga y manipulación del dataset (.xlsx) |
| `numpy` | Operaciones matriciales y vectoriales |
| `openpyxl` | Lectura de archivos Excel (.xlsx) |
| `pydantic` | Validación de datos de entrada en la API |

### Frontend (HTML/CSS/JS)
| Recurso | Uso |
|---|---|
| HTML5 + CSS3 | Estructura y estilos de la interfaz |
| JavaScript (Vanilla) | Lógica de la interfaz, llamadas a la API, renderizado de resultados |
| Chart.js 4.4.1 | Visualizaciones: gauge de score, barras de probabilidad, donut, proyección de ahorro |
| Google Fonts | Tipografías: Playfair Display, Epilogue, JetBrains Mono |

---

## 🗂️ Cómo construimos el dataset

El dataset fue generado con datos sintéticos (mock data) que simulan perfiles financieros reales de Colombia, almacenados en `Datos.xlsx` en la hoja `MOCK_DATA`.

**Columnas del dataset:**

| Columna | Descripción | Rango aproximado |
|---|---|---|
| `Gastos` | Gastos mensuales del cliente (COP) | $200.000 – $181.000.000 |
| `Ingresos` | Ingresos mensuales del cliente (COP) | $511.000 – $199.000.000 |
| `Deuda` | Monto total de la deuda a financiar (COP) | $5.373 – $199.000.000 |
| `Tiempo` | Plazo en meses | 3 – 60 meses |
| `PagaDeuda` | Variable objetivo: 1 = paga, 0 = no paga | Binaria |

Los perfiles cubren distintos estratos económicos y niveles de riesgo para que el modelo aprenda a distinguir entre clientes que sí pueden pagar y los que no.

---

## 📊 Cantidad de entradas utilizadas para entrenar el modelo

- **Total de registros:** 1.150 perfiles
- **Registros que sí pagan (clase 1):** 675 → 58.7%
- **Registros que no pagan (clase 0):** 475 → 41.3%
- **División entrenamiento / prueba:** 70% / 30% (805 train — 345 test)

---

## 🤖 Modelos de Machine Learning utilizados

Se evaluó y utilizó el siguiente modelo:

### Regresión Logística (`LogisticRegression`)
- Modelo de clasificación binaria supervisada
- Predice la probabilidad de que una persona **pague** o **no pague** su deuda
- Entrenado con las 4 variables del perfil financiero: `Gastos`, `Ingresos`, `Deuda`, `Tiempo`
- Los datos se normalizan con `StandardScaler` antes del entrenamiento
- Parámetros: `max_iter=1000`, `random_state=42`

---

## 🎯 Por qué elegimos este modelo

1. **Interpretabilidad:** La Regresión Logística entrega probabilidades directas (ej. "78.3% de probabilidad de pagar"), lo que es fundamental para explicar una decisión crediticia al usuario.

2. **Adecuación al problema:** El problema es de clasificación binaria (paga / no paga), que es exactamente el caso de uso para el que fue diseñada la Regresión Logística.

3. **Eficiencia:** Con 1.150 registros y 4 features, un modelo sencillo generaliza mejor que uno complejo que podría sobreajustarse.

4. **Facilidad de despliegue:** El modelo es liviano y se puede serializar y servir en tiempo real desde la API sin latencia.

---

## 📈 Nivel de efectividad — Métricas obtenidas

| Métrica | Valor |
|---|---|
| **Accuracy en test set** | 72.75% |
| **Accuracy con validación cruzada (CV=5)** | 68.09% promedio |
| **Desviación estándar CV** | ±10.74% |

### Reporte de clasificación (conjunto de prueba — 345 registros):

| Clase | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **No Paga (0)** | 0.68 | 0.56 | 0.61 | 133 |
| **Sí Paga (1)** | 0.75 | 0.83 | 0.79 | 212 |
| **Promedio ponderado** | 0.72 | 0.73 | 0.72 | 345 |

> El modelo muestra mejor desempeño identificando a quienes sí pagan (recall 83%), lo cual es adecuado para un analizador orientado al usuario: es más conservador aprobando que rechazando.

---

## 🔮 Predicciones generadas por el sistema

Para cada perfil ingresado, el modelo produce:

1. **Probabilidad de pago** → `predict_proba()` devuelve dos valores:
   - `prob[0]` = probabilidad de NO pagar (ej. 31.2%)
   - `prob[1]` = probabilidad de SÍ pagar (ej. 68.8%)

2. **Decisión binaria** → `APROBADO` si `score ≥ 50` y `excedente > 0`, de lo contrario `RECHAZADO`

3. **Score financiero 0–100** → calculado con las 4 dimensiones del perfil (ratio de gastos, nivel de deuda, capacidad de pago, probabilidad de incumplimiento)

4. **Plazo óptimo automático** → si no se especifica plazo, el sistema calcula el número de meses ideal para que la cuota sea ≤ 30% del disponible mensual

---

## 🔗 Cómo las predicciones construyen la solución al usuario

Las probabilidades del modelo no se muestran solas — se traducen en una experiencia completa:

```
predict_proba()
      ↓
  Score 0–100 ── semáforo (BAJO / MEDIO / ALTO riesgo)
      ↓
  Decisión APROBADO / RECHAZADO
      ↓
  Indicadores: cuota mensual, excedente, ratio de gastos, nivel de deuda
      ↓
  Proyección de ahorro a 3, 6 y 12 meses
      ↓
  Recomendación personalizada con pasos concretos
```

La predicción del modelo se convierte en orientación financiera accionable: si el modelo da alta probabilidad de no pagar, el sistema recomienda reducir gastos un 10–20% y ahorrar 3–6 meses antes de endeudarse.

---

## 🌐 Cómo llevamos la solución a la web

El sistema corre completamente en local con dos componentes desacoplados:

1. **Backend:** API REST construida con **FastAPI**, servida con **uvicorn** en `http://localhost:8000`
2. **Frontend:** Archivo `index.html` estático que se abre directamente en el navegador

La comunicación entre frontend y backend se hace mediante `fetch()` a los endpoints `/entrenar` y `/analizar`.

**Pasos para ejecutar:**
```bash
# 1. Instalar dependencias
pip install fastapi uvicorn scikit-learn pandas openpyxl numpy

# 2. Ir a la carpeta del proyecto
cd "ruta/del/proyecto"

# 3. Levantar el backend
uvicorn main:app --reload --port 8000

# 4. Abrir index.html en el navegador (doble clic)
```

---

## 🖥️ Explicación del frontend y backend

### Backend — `main.py` + `model.py`

**`model.py`** contiene toda la lógica ML y financiera:
- Carga del dataset desde `Datos.xlsx`
- Entrenamiento del modelo con `LogisticRegression` + `StandardScaler`
- Validación cruzada de 5 pliegues
- Funciones financieras: score, semáforo, segmentación, proyección de ahorro, plazo óptimo, recomendación

**`main.py`** expone 3 endpoints REST con FastAPI:

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Verifica si el modelo está entrenado |
| `POST` | `/entrenar` | Carga el dataset y entrena el modelo |
| `POST` | `/analizar` | Recibe perfil financiero y retorna el análisis completo |

### Frontend — `index.html` + `styles.css` + `app.js`

La interfaz tiene 3 secciones:

1. **Hero / Landing** → Presentación del producto con tarjetas informativas y pills de características
2. **Cómo funciona** → Grid de 6 tarjetas explicando las capacidades del sistema
3. **Analizador** → Flujo de dos pasos: entrenar el modelo → ingresar perfil → ver resultados

Los resultados incluyen: banner de decisión, 3 cards de capacidad de pago, gauge de score, gráfica de probabilidades, indicadores clave, donut de composición de ingresos, proyección de ahorro con barras, y recomendación personalizada.

---

## ⚙️ Cómo las predicciones generan nuevas reglas y comportamientos

Las salidas del modelo alimentan un motor de reglas en `model.py` que genera comportamiento dinámico:

| Predicción | Regla generada | Comportamiento en el sistema |
|---|---|---|
| `score < 50` | Alto riesgo | Banner rojo, decisión RECHAZADO, recomendación de ahorro previo |
| `50 ≤ score < 70` | Riesgo medio | Banner neutro, APROBADO con advertencias, recomendación de reducir gastos |
| `score ≥ 70` | Bajo riesgo | Banner verde, APROBADO, recomendación de crecimiento |
| `prob_no_paga > 0.7` | Penalización de score (-20 pts) | Score más bajo aunque otros indicadores sean buenos |
| `excedente < 0` | Sin capacidad de pago | Rechazo automático sin importar el score |
| `tiempo = null` | Calcular plazo óptimo | El sistema itera de 6 en 6 meses hasta encontrar cuota ≤ 30% del disponible |

---

## 🎨 Cómo funciona la interfaz y cuál es su objetivo

**Objetivo:** Que cualquier persona, sin conocimientos financieros, pueda entender en menos de 1 minuto si puede o no asumir una deuda, y qué debe hacer al respecto.

**Flujo de uso:**
1. El usuario entra a la página y ve una landing explicativa
2. Hace clic en **"Entrenar modelo"** → el sistema carga los 1.150 perfiles y entrena la Regresión Logística (tarda ~2 segundos)
3. Ingresa sus datos: ingresos, gastos, monto de la deuda y plazo opcional
4. El sistema llama al backend, procesa el perfil y renderiza:
   - Un **banner APROBADO / RECHAZADO** con el semáforo de riesgo
   - **Cards** con cuota mensual, disponible y excedente
   - **Gauge** con el score de 0–100
   - **Gráfica de probabilidades** (sí paga vs. no paga)
   - **Indicadores clave** con barras de progreso
   - **Donut** de composición del ingreso mensual
   - **Proyección de ahorro** a 3, 6 y 12 meses
   - **Recomendación personalizada** con pasos concretos

---

## 📁 Estructura del proyecto

```
Machine Learning/
├── index.html                     # Estructura HTML de la interfaz
├── styles.css                     # Estilos y diseño visual
├── app.js                         # Lógica del frontend (Chart.js, API calls)
├── main.py                        # API REST con FastAPI
├── model.py                       # Lógica ML y funciones financieras
├── Datos.xlsx                     # Dataset con 1.150 perfiles (hoja: MOCK_DATA)
└── Instrucciones de Ejecución.txt # Guía de instalación y ejecución
```

---

*Proyecto desarrollado para la materia de Inteligencia Artificial · 2026*
