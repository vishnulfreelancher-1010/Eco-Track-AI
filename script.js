// script.js - EcoTrack AI (modern redesign)
// Preserves original calculation logic: bike*0.05 + car*0.20 + electricity*0.85
// Adds UI interactions: chart, eco meter, counters, theme toggle, download report.

(() => {
  // Cached elements
  const bikeInput = document.getElementById('bike');
  const carInput = document.getElementById('car');
  const electricityInput = document.getElementById('electricity');
  const transportSelect = document.getElementById('transport');

  const resultEl = document.getElementById('result');
  const levelEl = document.getElementById('level');
  const suggestionEl = document.getElementById('suggestion');
  const scoreTextEl = document.getElementById('meterText');
  const meterPath = document.getElementById('meterPath');
  const ecoMeterContainer = document.getElementById('ecoMeter');

  const treesEl = document.getElementById('trees');
  const annualEl = document.getElementById('annual');

  const aiPanel = document.getElementById('aiPanel');
  const transportHint = document.getElementById('transport-hint');

  const themeToggleBtn = document.getElementById('themeToggle');
  const downloadCta = document.getElementById('download-cta');

  let myChart = null;

  // Default per-km factors (kg CO₂ per km or per kWh)
  const FACTORS = {
    bike: 0.05,
    // default car factor matches original script (petrol 0.20)
    transport: {
      petrol: 0.20,
      diesel: 0.22,
      ev: 0.07,
      bus: 0.08,
      train: 0.05
    },
    electricity: 0.85
  };

  // Initialize UI
  function init() {
    // wire transport update
    transportSelect.addEventListener('change', updateTransportHint);
    updateTransportHint();

    // theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
    downloadCta && downloadCta.addEventListener('click', downloadReport);

    // animate hero stats
    animateHeroStats();

    // initial chart
    renderChart(0, 0, 0);

    // hookup default calculate on input change (lightweight)
    [bikeInput, carInput, electricityInput].forEach(inp => {
      inp.addEventListener('input', () => {
        // do not spam heavy tasks; a small debounce
        window.clearTimeout(inp._t);
        inp._t = window.setTimeout(calculate, 250);
      });
    });
  }

  // Update transport hint text and use factor for calculations
  function updateTransportHint() {
    const t = transportSelect.value;
    const f = FACTORS.transport[t] ?? FACTORS.transport.petrol;
    transportHint.textContent = `Per-km factor applied to car input: ${f.toFixed(2)} kg/km`;
  }

  // Core calculate function — preserves existing semantics by using the selected transport factor for car
  window.calculate = function calculate() {
    const bike = Number(bikeInput.value) || 0;
    const car = Number(carInput.value) || 0;
    const electricity = Number(electricityInput.value) || 0;

    const transportType = transportSelect.value;
    const carFactor = FACTORS.transport[transportType] ?? FACTORS.transport.petrol;

    // Use original formula for bike/electricity; car uses selected factor.
    // Original default for car was 0.20 (petrol) — preserved by default.
    const carbon = (bike * FACTORS.bike) + (car * carFactor) + (electricity * FACTORS.electricity);

    // Update result UI
    resultEl.innerHTML = `${carbon.toFixed(2)} kg`;
    animateNumberTo(treesEl, Math.ceil(carbon / 2), 700);
    animateNumberTo(annualEl, Math.round(carbon * 365), 700, true);

    // Determine level and color
    let level = '';
    let color = '';
    if (carbon < 10) {
      level = 'Eco Hero';
      color = getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#198754';
    } else if (carbon < 25) {
      level = 'Green Citizen';
      color = '#0d6efd';
    } else if (carbon < 50) {
      level = 'Average User';
      color = getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || '#ffc107';
    } else {
      level = 'High Carbon User';
      color = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#dc3545';
    }
    levelEl.textContent = level;
    levelEl.style.color = color;

    // Suggestions (AI panel)
    const suggestions = [];
    if (car > 20) suggestions.push('Consider shifting to public transport or carpooling for long trips.');
    if (electricity > 10) suggestions.push('Reduce electricity usage: switch to LED bulbs, smart thermostats, or renewable energy plans.');
    if (bike > 5) suggestions.push('Great job! Increase cycling and short rides to further reduce emissions.');
    if (car === 0 && electricity === 0 && bike === 0) suggestions.push('Enter some activity to calculate your footprint.');

    if (suggestions.length === 0) suggestions.push('Excellent eco-friendly lifestyle. Small adjustments can make an even bigger impact.');

    suggestionEl.innerHTML = suggestions.map(s => `<div class="ai-tip">${s}</div>`).join('');
    aiPanel.querySelector('.ai-suggestions')?.querySelectorAll('.ai-tip');

    // Eco score (higher is better). Keep the original basic approach: 100 - carbon (but clamp)
    const baseScore = Math.max(0, 100 - carbon);
    const score = Math.min(100, Math.round(baseScore));
    updateEcoMeter(score, color);

    // Update Chart
    const bikeVal = +(bike * FACTORS.bike).toFixed(3);
    const carVal = +(car * carFactor).toFixed(3);
    const elecVal = +(electricity * FACTORS.electricity).toFixed(3);
    renderChart(bikeVal, carVal, elecVal);

    // For accessibility, summary text
    ecoMeterContainer.setAttribute('aria-label', `Eco score ${score} percent. ${level}.`);
  };

  // Animate numbers for counters
  function animateNumberTo(el, target, duration = 800, addSuffixKg = false) {
    const start = Number(el.dataset.start) || 0;
    const from = start;
    const to = target;
    const startTs = performance.now();
    el.dataset.start = target; // update start for next time
    function step(ts) {
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = easeOutCubic(p);
      const cur = Math.round(from + (to - from) * eased);
      el.textContent = addSuffixKg ? `${cur} kg` : `${cur}`;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function easeOutCubic(t) { return (--t) * t * t + 1; }

  // Eco meter (circular) update
  function updateEcoMeter(score, color) {
    // score 0..100 maps to stroke-dasharray on 100 circle
    const percent = Math.max(0, Math.min(100, score));
    const dash = `${percent}, 100`;
    meterPath.setAttribute('stroke-dasharray', dash);
    meterPath.style.stroke = color;
    scoreTextEl.textContent = `${percent}%`;
  }

  // Render Chart.js pie/doughnut
  function renderChart(bikeVal, carVal, elecVal) {
    const ctx = document.getElementById('carbonChart').getContext('2d');

    const data = [bikeVal, carVal, elecVal];
    const total = data.reduce((a,b)=>a+b,0) || 1;

    const colors = [
      'rgba(34,197,94,0.9)', // bike - green
      'rgba(14,165,233,0.9)', // car - blue
      'rgba(99,102,241,0.9)' // electricity - indigo
    ];

    if (myChart) {
      myChart.data.datasets[0].data = data;
      myChart.update();
    } else {
      myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Bike', 'Car / Transport', 'Electricity'],
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed || 0;
                  const pct = ((v / total) * 100).toFixed(1);
                  return `${ctx.label}: ${v} kg (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Legend update
    const legend = document.getElementById('chartLegend');
    if (legend) {
      legend.innerHTML = `
        <div class="legend-item"><span class="swatch" style="background:${colors[0]}"></span> Bike — ${bikeVal.toFixed(2)} kg</div>
        <div class="legend-item"><span class="swatch" style="background:${colors[1]}"></span> Car — ${carVal.toFixed(2)} kg</div>
        <div class="legend-item"><span class="swatch" style="background:${colors[2]}"></span> Electricity — ${elecVal.toFixed(2)} kg</div>
      `;
    }
  }

  // Animated hero stats
  function animateHeroStats() {
    const els = document.querySelectorAll('.stat-number[data-target]');
    els.forEach(el => {
      const raw = el.getAttribute('data-target');
      const numeric = parseFloat(raw.replace(/,/g, '')) || 0;
      const decimals = raw.indexOf('.') >= 0 ? 1 : 0;
      const duration = 900 + Math.random() * 400;
      let start = 0;
      const startTs = performance.now();
      function step(ts) {
        const p = Math.min(1, (ts - startTs) / duration);
        const val = Math.round(numeric * easeOutCubic(p) * (decimals?10:1)) / (decimals?10:1);
        el.textContent = val.toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // Theme toggle handler
  function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('theme-dark');
    if (isDark) {
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      themeToggleBtn.textContent = '☀️';
      themeToggleBtn.setAttribute('aria-pressed', 'true');
    } else {
      body.classList.remove('theme-light');
      body.classList.add('theme-dark');
      themeToggleBtn.textContent = '🌙';
      themeToggleBtn.setAttribute('aria-pressed', 'false');
    }
    // update chart colors for theme if needed (Chart uses explicit colors so fine)
  }

  // Download a simple CSV report (inputs + results)
  window.downloadReport = function downloadReport() {
    const bike = Number(bikeInput.value) || 0;
    const car = Number(carInput.value) || 0;
    const electricity = Number(electricityInput.value) || 0;
    const transportType = transportSelect.value;
    const carFactor = FACTORS.transport[transportType] ?? FACTORS.transport.petrol;
    const carbon = (bike * FACTORS.bike) + (car * carFactor) + (electricity * FACTORS.electricity);
    const score = Math.min(100, Math.max(0, Math.round(100 - carbon)));

    const rows = [
      ['EcoTrack AI - Emission Report'],
      ['Timestamp', new Date().toISOString()],
      ['Inputs', 'Value'],
      ['Bike (km)', bike],
      ['Car (km)', car],
      ['Transport Type', transportType],
      ['Car factor (kg/km)', carFactor],
      ['Electricity (kWh)', electricity],
      [],
      ['Results','Value'],
      ['Total Carbon (kg CO2)', carbon.toFixed(2)],
      ['Eco Score (0-100)', score],
      ['Trees Needed', Math.ceil(carbon / 2)],
      ['Yearly CO2 (kg)', Math.round(carbon * 365)]
    ];

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eco_report_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // initialize on dom ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window._eco = {
    calculate,
    downloadReport,
    renderChart,
    FACTORS
  };

})();