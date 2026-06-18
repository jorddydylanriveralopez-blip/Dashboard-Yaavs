/** Ejecutar una vez: node server/seed-init.mjs — carga el tablero marketing al servidor */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'store.json');

// Datos inline (evita import TS)
const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-board.json'), 'utf8'),
);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.writeFileSync(
  DB_PATH,
  JSON.stringify(
    {
      board: seed,
      assignments: [],
      calendars: {},
      passwordOverrides: {},
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log('Seed guardado en', DB_PATH);
