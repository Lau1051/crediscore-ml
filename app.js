const API = 'https://crediscore-ml.onrender.com';
let modeloOk = false;
let charts = {};

// ── FORMATEO DE INPUTS CON MILES ─────────────────────────
function fmtMiles(el) {
  const cursor = el.selectionStart;
  const prevLen = el.value.length;
  let raw = el.value.replace(/[^\d]/g, '');
  if (raw === '') { el.value = ''; return; }
  const formatted = parseInt(raw, 10).toLocaleString('es-CO');
  el.value = formatted;
  // Ajustar posición del cursor
  const diff = formatted.length - prevLen;
  el.setSelectionRange(cursor + diff, cursor + diff);
}

function fmtEntero(el) {
  el.value = el.value.replace(/[^\d]/g, '');
}

function parseValMiles(id) {
  const raw = document.getElementById(id).value.replace(/\./g, '').replace(/,/g, '').trim();
  return raw === '' ? NaN : parseFloat(raw);
}

// ── PILL ──────────────────────────────────────────────────
function setPill(state, txt) {
  const p = document.getElementById('nav-pill');
  p.className = 'nav-pill' + (state === 'ok' ? ' ready' : state === 'err' ? ' error' : '');
  document.getElementById('pill-txt').textContent = txt;
  modeloOk = state === 'ok';
  document.getElementById('btn-analizar').disabled = !modeloOk;
}

// ── HEALTH CHECK ──────────────────────────────────────────
async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2500) });
    const d = await r.json();
    if (d.modelo_entrenado) {
      setPill('ok', 'Modelo listo');
      try {
        const s = await fetch(`${API}/modelo/stats`);
        if (s.ok) renderTrainMeta(await s.json());
      } catch {}
    } else {
      setPill('', 'Sin modelo');
    }
  } catch {
    setPill('err', 'API no disponible — corre uvicorn en :8000');
  }
}
checkHealth();

// ── ENTRENAR ──────────────────────────────────────────────
async function entrenar() {
  const btn = document.getElementById('btn-train');
  btn.disabled = true; btn.textContent = 'Entrenando…';
  setPill('', 'Entrenando…');
  try {
    const r = await fetch(`${API}/entrenar`, { method:'POST' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || 'Error');
    setPill('ok', 'Modelo listo');
    renderTrainMeta(d.estadisticas);
    btn.textContent = '✓ Reentrenar';
  } catch(e) {
    setPill('err', 'Error al entrenar');
    setResults(`<div class="err-box">⚠️ ${e.message}</div>`);
    btn.textContent = '⚡ Reintentar';
  }
  btn.disabled = false;
}

function renderTrainMeta(s) {
  const meta = document.getElementById('tc-meta');
  meta.style.display = 'flex';
  document.getElementById('m-reg').textContent    = s.total_registros.toLocaleString('es-CO');
  document.getElementById('m-pagan').textContent  = s.pagan.toLocaleString('es-CO');
  document.getElementById('m-nopagan').textContent= s.no_pagan.toLocaleString('es-CO');
}

// ── ANALIZAR ──────────────────────────────────────────────
async function analizar() {
  const ingreso = parseValMiles('f-ingreso');
  const gastos  = parseValMiles('f-gastos');
  const deuda   = parseValMiles('f-deuda');
  const tv      = document.getElementById('f-tiempo').value.trim();
  const tiempo  = tv ? parseInt(tv) : null;

  if (!ingreso || isNaN(ingreso)) return alert('Ingresa tus ingresos mensuales.');
  if (isNaN(gastos) || gastos < 0) return alert('Ingresa tus gastos mensuales.');
  if (isNaN(deuda)  || deuda < 0)  return alert('Ingresa el monto de la deuda.');
  if (gastos >= ingreso) return alert('Los gastos no pueden ser mayores o iguales a los ingresos.');

  setResults('<div class="loader"><div class="spinner"></div>Analizando tu perfil financiero…</div>');

  try {
    const body = { ingreso, gastos, deuda };
    if (tiempo) body.tiempo = tiempo;
    const r = await fetch(`${API}/analizar`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || 'Error al analizar');
    renderResultado(d);
    // Scroll suave a resultados
    setTimeout(() => document.getElementById('results').scrollIntoView({behavior:'smooth', block:'start'}), 100);
  } catch(e) {
    setResults(`<div class="err-box">⚠️ ${e.message}</div>`);
  }
}

// ── RENDER ────────────────────────────────────────────────
function fmt(n)  { return '$' + Math.round(n).toLocaleString('es-CO'); }
function pct(n)  { return n.toFixed(1) + '%'; }
function num(n)  { return n.toLocaleString('es-CO'); }

function renderResultado(d) {
  const ap  = d.decision.aprobado;
  const sc  = d.score.valor;
  const sem = d.score.semaforo;
  const chipCls = sem.includes('BAJO') ? 'chip-g' : sem.includes('MEDIO') ? 'chip-y' : 'chip-r';
  const dbCls   = ap ? 'db-approved' : 'db-rejected';
  const excPos  = d.capacidad_pago.excedente >= 0;
  const maxAh   = d.proyeccion_ahorro.doce_meses || 1;

  // ratio cuota/disponible
  const ratioCuota = d.capacidad_pago.pago_mensual / d.capacidad_pago.disponible * 100;

  const html = `
    <!-- ① DECISIÓN -->
    <div class="decision-banner ${dbCls}">
      <div class="db-left">
        <div class="db-verdict">${ap ? '✓ APROBADO' : '✕ RECHAZADO'}</div>
        <span class="chip ${chipCls}">${sem}</span>
        ${d.perfil.tiempo_calculado
          ? `<div class="db-time">⏱ Plazo calculado automáticamente: <strong>${d.perfil.tiempo} meses</strong></div>`
          : `<div class="db-time">⏱ Plazo solicitado: <strong>${d.perfil.tiempo} meses</strong></div>`}
      </div>
      </div>
    </div>

    <!-- ② CAPACIDAD DE PAGO -->
    <div class="card-3">
      <div class="info-card">
        <div class="ic-label">Disponible / mes</div>
        <div class="ic-value">${fmt(d.capacidad_pago.disponible)}</div>
        <div class="ic-sub">Ingresos − Gastos</div>
      </div>
      <div class="info-card">
        <div class="ic-label">Cuota mensual estimada</div>
        <div class="ic-value">${fmt(d.capacidad_pago.pago_mensual)}</div>
        <div class="ic-sub">${d.perfil.tiempo} meses · representa el ${pct(Math.min(ratioCuota,100))} del disponible</div>
      </div>
      <div class="info-card">
        <div class="ic-label">Excedente mensual</div>
        <div class="ic-value ${excPos ? 'positive' : 'negative'}">${fmt(d.capacidad_pago.excedente)}</div>
        <div class="ic-sub">Lo que te queda después de pagar la cuota</div>
      </div>
    </div>

    <!-- ③ GRÁFICAS FILA 1: Score gauge + Probabilidades -->
    <div class="charts-grid">
      <div class="sec-card">
        <div class="sc-title">Score financiero (${sc}/100)</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px;margin-top:-10px">
          0–49 Alto riesgo &nbsp;·&nbsp; 50–74 Riesgo medio &nbsp;·&nbsp; 75–100 Bajo riesgo
        </div>
        <div class="chart-wrap" style="height:200px">
          <canvas id="chart-gauge"></canvas>
        </div>
      </div>
      <div class="sec-card">
        <div class="sc-title">Probabilidades del modelo</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px;margin-top:-10px">
          Probabilidad de que el cliente cumpla o incumpla con la deuda
        </div>
        <div class="chart-wrap" style="height:200px">
          <canvas id="chart-prob"></canvas>
        </div>
      </div>
    </div>

    <!-- ④ INDICADORES CLAVE -->
    <div class="sec-card">
      <div class="sc-title">Indicadores clave del perfil</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
        <div>
          <div class="bar-row">
            <div class="bar-meta">
              <span style="font-size:12px;color:var(--muted)">Gastos sobre ingresos</span>
              <span style="font-family:var(--mono);font-size:12px">${pct(d.indicadores.ratio_gastos_pct)} — ${d.indicadores.nivel_gasto}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${d.indicadores.ratio_gastos_pct > 70 ? 'fill-red' : d.indicadores.ratio_gastos_pct > 40 ? 'fill-gold' : 'fill-teal'}"
                   style="width:${Math.min(d.indicadores.ratio_gastos_pct,100)}%"></div>
            </div>
          </div>
          <div class="bar-row">
            <div class="bar-meta">
              <span style="font-size:12px;color:var(--muted)">Cuota mensual sobre disponible</span>
              <span style="font-family:var(--mono);font-size:12px">${pct(Math.min(ratioCuota,100))}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${ratioCuota > 100 ? 'fill-red' : ratioCuota > 50 ? 'fill-gold' : 'fill-teal'}"
                   style="width:${Math.min(ratioCuota,100)}%"></div>
            </div>
          </div>
          <div class="bar-row">
          </div>
        </div>
        <div>
          <div class="ind-row"><span class="ind-key">Nivel de gastos</span><span class="ind-val">${d.indicadores.nivel_gasto} (${pct(d.indicadores.ratio_gastos_pct)})</span></div>
          <div class="ind-row"><span class="ind-key">Deuda equivale a</span><span class="ind-val">${d.diagnostico.meses_equiv} mes(es) de ingreso</span></div>
          <div class="ind-row"><span class="ind-key">Nivel de deuda</span><span class="ind-val">${d.diagnostico.nivel_deuda_txt}</span></div>
          <div class="ind-row"><span class="ind-key">Riesgo de no pagar</span><span class="ind-val">${d.indicadores.riesgo_no_paga}</span></div>
          <div class="ind-row"><span class="ind-key">Máx. deuda recomendada</span><span class="ind-val">${fmt(d.indicadores.max_endeudamiento)}</span></div>
          <div class="ind-row"><span class="ind-key">Cubre la cuota</span>
            <span class="ind-val" style="color:${d.diagnostico.cubre_cuota ? 'var(--teal)' : 'var(--red)'}">${d.diagnostico.cubre_cuota ? 'Sí ✓' : 'No ✕'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ⑤ GRÁFICA: Composición mensual -->
    <div class="charts-grid">
      <div class="sec-card">
        <div class="sc-title">Composición de tu ingreso mensual</div>
        <div class="chart-wrap" style="height:240px">
          <canvas id="chart-donut"></canvas>
        </div>
      </div>
      <div class="sec-card">
        <div class="sc-title">Proyección de ahorro acumulado</div>
        <div class="chart-wrap" style="height:240px">
          <canvas id="chart-ahorro"></canvas>
        </div>
      </div>
    </div>

    <!-- ⑥ PROYECCIÓN AHORRO TABLA -->
    <div class="sec-card">
      <div class="sc-title">Proyección de ahorro si ahorras tu excedente mensual</div>
      <div class="ind-row" style="margin-bottom:14px">
        <span class="ind-key">Ahorro mensual potencial</span>
        <span class="ind-val">${fmt(d.proyeccion_ahorro.mensual)}</span>
      </div>
      ${[['3 meses', d.proyeccion_ahorro.tres_meses], ['6 meses', d.proyeccion_ahorro.seis_meses], ['12 meses', d.proyeccion_ahorro.doce_meses]].map(([l,v]) => `
      <div class="sav-row">
        <div class="sav-label">${l}</div>
        <div class="sav-track"><div class="sav-fill" style="width:${Math.min((v/maxAh)*100,100)}%"></div></div>
        <div class="sav-val">${fmt(v)}</div>
      </div>`).join('')}
    </div>

    <!-- ⑦ RECOMENDACIÓN -->
    <div class="sec-card" style="border-left:4px solid ${ap ? 'var(--teal)' : 'var(--red)'}">
      <div class="sc-title">Recomendación personalizada</div>
      <div class="recom-text">${d.recomendacion.replace(/\n/g,'<br>')}</div>
      <div class="recom-foot">Análisis basado en: ${d.diagnostico.explicacion}</div>
    </div>
  `;

  setResults(html);

  // Destruir charts anteriores
  Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
  charts = {};

  // Renderizar charts en el siguiente tick
  setTimeout(() => {
    renderCharts(d, sc, ratioCuota);
  }, 80);
}

function renderCharts(d, sc, ratioCuota) {
  const teal  = '#1a7a6e';
  const gold  = '#c9a84c';
  const red   = '#c0392b';
  const ink   = '#0f0e17';
  const muted = '#7a7668';
  const line  = '#e0dcd2';

  Chart.defaults.font.family = "'Epilogue', sans-serif";
  Chart.defaults.color = muted;

  // ① GAUGE — Score como doughnut
  const gaugeEl = document.getElementById('chart-gauge');
  if (gaugeEl) {
    const remaining = 100 - sc;
    const scoreColor = sc >= 75 ? teal : sc >= 50 ? gold : red;
    charts.gauge = new Chart(gaugeEl, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [sc, remaining],
          backgroundColor: [scoreColor, line],
          borderWidth: 0,
          circumference: 270,
          rotation: 225,
        }]
      },
      options: {
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        animation: { animateRotate: true, duration: 900 }
      },
      plugins: [{
        id: 'scoreText',
        afterDraw(chart) {
          const { ctx, chartArea: { left, right, top, bottom } } = chart;
          const cx = (left + right) / 2;
          const cy = (top + bottom) / 2 + 20;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = scoreColor;
          ctx.font = "bold 44px 'Playfair Display', serif";
          ctx.fillText(sc, cx, cy);
          ctx.fillStyle = muted;
          ctx.font = "13px 'Epilogue', sans-serif";
          ctx.fillText('de 100', cx, cy + 24);
          ctx.restore();
        }
      }]
    });
  }

  // ② PROBABILIDADES — barras horizontales con etiquetas de valor
const probEl = document.getElementById('chart-prob');
if (probEl) {
  charts.prob = new Chart(probEl, {
    type: 'bar',
    data: {
      labels: ['Sí paga', 'No paga'],
      datasets: [{
        data: [d.probabilidades.si_paga, d.probabilidades.no_paga],
        backgroundColor: [teal, red],
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 48 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          max: 100,
          grid: { color: line },
          ticks: { callback: v => v + '%' }
        },
        y: { grid: { display: false } }
      },
      animation: { duration: 800 }
    },
    plugins: [{
      id: 'barLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          chart.getDatasetMeta(i).data.forEach((bar, j) => {
            const val = dataset.data[j];
            ctx.save();
            ctx.fillStyle = '#3a3a3a';
            ctx.font = "600 13px 'JetBrains Mono', monospace";
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(val.toFixed(1) + '%', bar.x + 8, bar.y);
            ctx.restore();
          });
        });
      }
    }]
  });
}

  // ③ DONUT — Composición ingreso
  const donutEl = document.getElementById('chart-donut');
  if (donutEl) {
    const ingreso  = d.perfil.ingreso;
    const gastos   = d.perfil.gastos;
    const cuota    = d.capacidad_pago.pago_mensual;
    const excedente= Math.max(d.capacidad_pago.excedente, 0);
    const deficit  = Math.max(-d.capacidad_pago.excedente, 0);

    const labels = excedente > 0
      ? ['Gastos', 'Cuota deuda', 'Excedente']
      : ['Gastos', 'Cuota deuda', 'Déficit'];
    const data = excedente > 0
      ? [gastos, cuota, excedente]
      : [gastos, cuota, deficit];
    const colors = excedente > 0
      ? [gold, '#6b4f1e', teal]
      : [gold, '#6b4f1e', red];

    charts.donut = new Chart(donutEl, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#faf9f6' }]
      },
      options: {
        cutout: '60%',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 14,
              font: { size: 12 },
              // ✅ Agrega porcentaje junto al nombre en la leyenda
              generateLabels: (chart) => {
                const ds = chart.data.datasets[0];
                const total = ds.data.reduce((a, b) => a + b, 0);
                return chart.data.labels.map((label, i) => ({
                  text: `${label} (${((ds.data[i] / total) * 100).toFixed(1)}%)`,
                  fillStyle: ds.backgroundColor[i],
                  strokeStyle: ds.backgroundColor[i],
                  lineWidth: 0,
                  index: i
                }));
              }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.raw;
                const p = ((val / ingreso) * 100).toFixed(1);
                return ` $${Math.round(val).toLocaleString('es-CO')} (${p}%)`;
              }
            }
          }
        },
        animation: { duration: 900 }
      },
      // ✅ Plugin que dibuja el % encima de cada segmento
      plugins: [{
        id: 'donutPctLabels',
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          const ds = chart.data.datasets[0];
          const total = ds.data.reduce((a, b) => a + b, 0);
          const meta = chart.getDatasetMeta(0);
          meta.data.forEach((arc, i) => {
            const val = ds.data[i];
            if (!val || (val / total) < 0.04) return; // omite segmentos muy pequeños
            const angle = (arc.startAngle + arc.endAngle) / 2;
            const r = (arc.innerRadius + arc.outerRadius) / 2;
            const x = arc.x + Math.cos(angle) * r;
            const y = arc.y + Math.sin(angle) * r;
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = "bold 11px 'JetBrains Mono', monospace";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(((val / total) * 100).toFixed(0) + '%', x, y);
            ctx.restore();
          });
        }
      }]
    });
  }

  // ④ BARRA AHORRO ACUMULADO
  const ahorroEl = document.getElementById('chart-ahorro');
  if (ahorroEl) {
    charts.ahorro = new Chart(ahorroEl, {
      type: 'bar',
      data: {
        labels: ['3 meses', '6 meses', '12 meses'],
        datasets: [{
          label: 'Ahorro acumulado',
          data: [
            d.proyeccion_ahorro.tres_meses,
            d.proyeccion_ahorro.seis_meses,
            d.proyeccion_ahorro.doce_meses
          ],
          backgroundColor: [
            'rgba(26,122,110,.5)',
            'rgba(26,122,110,.75)',
            'rgba(26,122,110,1)',
          ],
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' $' + Math.round(ctx.raw).toLocaleString('es-CO')
            }
          }
        },
        scales: {
          y: {
            grid: { color: line },
            ticks: { callback: v => '$' + (v/1000000).toFixed(1) + 'M' }
          },
          x: { grid: { display: false } }
        },
        animation: { duration: 900 }
      },
      plugins: [{
        id: 'ahorroLabels',
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          chart.data.datasets.forEach((dataset, i) => {
            chart.getDatasetMeta(i).data.forEach((bar, j) => {
              const val = dataset.data[j];
              if (!val) return;
              ctx.save();
              ctx.fillStyle = muted;
              ctx.font = "11px 'JetBrains Mono', monospace";
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText('$' + Math.round(val).toLocaleString('es-CO'), bar.x, bar.y - 4);
              ctx.restore();
            });
          });
        }
      }]
    });
  }
}

function setResults(html) {
  document.getElementById('results').innerHTML = html;
}

// Enter para enviar
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && modeloOk &&
      document.activeElement.closest('.form-card')) {
    analizar();
  }
});
