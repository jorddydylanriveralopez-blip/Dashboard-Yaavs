#!/usr/bin/env node
/**
 * Smoke check for Yaavs dashboard API after deploy.
 * Usage: node scripts/smoke-dashboard.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://darkred-wasp-801835.hostingersite.com').replace(/\/$/, '');

async function get(path, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, { cache: 'no-store', signal: ctrl.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, bytes: text.length };
  } finally {
    clearTimeout(t);
  }
}

function fail(msg) {
  console.error(`FAIL  ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

const health = await get('/api/health', 10_000);
if (!health.ok) fail(`/api/health → ${health.status}`);
else ok(`/api/health`);

const state = await get('/api/state', 120_000);
if (!state.ok) fail(`/api/state → ${state.status}`);
else {
  let data;
  try {
    data = JSON.parse(state.text);
  } catch {
    fail('/api/state JSON inválido');
    data = null;
  }
  if (data) {
    const projects = data.board?.projects ?? [];
    const extras = data.extraProjects ?? [];
    const done = projects.filter((p) => p.status === 'terminado').length;
    ok(`/api/state ${Math.round(state.bytes / 1024)} KB · projects=${projects.length} terminado=${done} extras=${extras.length}`);
    if (projects.length < 1) fail('sin proyectos en el tablero');
    if (!Array.isArray(extras)) fail('extraProjects no es lista');

    let evidenceOk = 0;
    let evidenceBad = 0;
    for (const p of projects) {
      for (const up of p.progressUpdates ?? []) {
        for (const f of [...(up.files ?? []), ...(up.images ?? [])]) {
          const du = f?.dataUrl || '';
          if (!du) continue;
          if (du.startsWith('/evidence/') || du.startsWith('/api/evidence/')) {
            const probe = await get(du, 20_000);
            if (probe.ok) evidenceOk += 1;
            else {
              evidenceBad += 1;
              fail(`evidencia ${du} → ${probe.status}`);
            }
          }
        }
      }
    }
    if (evidenceOk) ok(`evidencias accesibles: ${evidenceOk}`);
    if (!evidenceBad && evidenceOk === 0) ok('sin evidencias por verificar (ok)');
  }
}

if (process.exitCode) {
  console.error(`\nSmoke falló contra ${base}`);
  process.exit(process.exitCode);
}
console.log(`\nSmoke OK · ${base}`);
