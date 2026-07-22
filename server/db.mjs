import pg from 'pg';

let pgPool = null;
let neonSql = null;

export function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

function isNeonUrl(url) {
  return /neon\.tech/i.test(url || '');
}

/**
 * Tagged-template SQL compatible con Neon (HTTP) y Postgres/Supabase (pg).
 * Uso: await sql`SELECT * FROM t WHERE id = ${id}`
 * Devuelve siempre un array de filas.
 */
export async function sql(strings, ...values) {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL no configurada');

  if (isNeonUrl(url)) {
    if (!neonSql) {
      const { neon } = await import('@neondatabase/serverless');
      neonSql = neon(url);
    }
    return neonSql(strings, ...values);
  }

  if (!pgPool) {
    pgPool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
  }

  let text = '';
  const params = [];
  for (let i = 0; i < strings.length; i += 1) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }

  const result = await pgPool.query(text, params);
  return result.rows;
}
