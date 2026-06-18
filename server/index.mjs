import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'store.json');
const PORT = Number(process.env.PORT) || 3001;

const defaultState = () => ({
  board: {
    companyName: 'Yaavs',
    tasks: [],
  },
  assignments: [],
  calendars: {},
  passwordOverrides: {},
  updatedAt: new Date().toISOString(),
});

function readDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return defaultState();
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'yaavs-board' });
});

app.get('/api/state', (_req, res) => {
  res.json(readDb());
});

app.put('/api/state', (req, res) => {
  const body = req.body;
  if (!body?.board) {
    res.status(400).json({ error: 'Estado inválido' });
    return;
  }
  writeDb({
    board: body.board,
    assignments: body.assignments ?? [],
    calendars: body.calendars ?? {},
    passwordOverrides: body.passwordOverrides ?? {},
    updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Yaavs API en http://localhost:${PORT}`);
  if (!fs.existsSync(DB_PATH)) {
    writeDb(defaultState());
    console.log('Base de datos inicial creada en server/data/store.json');
  }
});
