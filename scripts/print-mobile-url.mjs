import os from 'os';

function getLocalIpv4() {
  try {
    const nets = os.networkInterfaces();
    const candidates = [];
    for (const ifaces of Object.values(nets)) {
      for (const net of ifaces ?? []) {
        if (net.family !== 'IPv4' || net.internal) continue;
        candidates.push(net.address);
      }
    }
    return candidates.find((ip) => ip.startsWith('192.168.')) ?? candidates[0] ?? null;
  } catch {
    return null;
  }
}

const ip = getLocalIpv4();
const port = process.env.PORT || '5173';

console.log('');
console.log('  ┌─────────────────────────────────────────────────────┐');
console.log('  │  Yaavs — en CELULAR (misma Wi‑Fi que esta Mac)      │');
console.log('  └─────────────────────────────────────────────────────┘');
if (ip) {
  console.log(`  →  http://${ip}:${port}`);
} else {
  console.log('  →  No detecté IP Wi‑Fi. En la Mac: Ajustes → Red → Wi‑Fi → Detalles → IP');
  console.log(`     Luego abre: http://TU-IP:${port}`);
}
console.log('');
console.log('  No uses localhost en el teléfono (solo funciona en esta computadora).');
console.log('');
