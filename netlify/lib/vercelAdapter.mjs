// Adaptador compartido: ejecuta handlers estilo Vercel (`export default (req,res)`)
// dentro de funciones Netlify, soportando invocación v2 (Web Request/Response)
// y v1 (evento Lambda). Cada función pasa su propio mapa de rutas.

const FN_PREFIX = '/.netlify/functions/';

function normalizePath(pathname) {
  let p = pathname || '/';
  if (p.startsWith(FN_PREFIX)) {
    // /.netlify/functions/<name>/<resto>  ->  /api/<resto>
    const rest = p.slice(FN_PREFIX.length).split('/').slice(1).join('/');
    p = `/api${rest ? `/${rest}` : ''}`;
  }
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

function errMsg(error) {
  return error instanceof Error ? error.message : String(error);
}

async function readIncoming(request) {
  if (
    request &&
    (typeof request.httpMethod === 'string' || typeof request.rawUrl === 'string')
  ) {
    const method = request.httpMethod || 'GET';
    const fullUrl = request.rawUrl || `https://local${request.path || '/'}`;
    const url = new URL(fullUrl);
    const headers = {};
    for (const [key, value] of Object.entries(request.headers || {})) {
      headers[key.toLowerCase()] = value;
    }
    let rawBody = request.body || '';
    if (rawBody && request.isBase64Encoded) {
      rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    }
    return { version: 1, method, url, headers, rawBody };
  }

  const url = new URL(request.url);
  const headers = {};
  for (const [key, value] of request.headers) headers[key.toLowerCase()] = value;
  let rawBody = '';
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    rawBody = await request.text();
  }
  return { version: 2, method: request.method, url, headers, rawBody };
}

function ensureJson(resHeaders) {
  if (!resHeaders['Content-Type'] && !resHeaders['content-type']) {
    resHeaders['Content-Type'] = 'application/json';
  }
}

function runHandler(routeHandler, req) {
  return new Promise((resolve) => {
    let statusCode = 200;
    const resHeaders = {};
    let settled = false;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolve({ status: statusCode, headers: resHeaders, body: payload ?? null });
    };

    const res = {
      setHeader(key, value) {
        resHeaders[key] = String(value);
      },
      getHeader(key) {
        return resHeaders[key];
      },
      removeHeader(key) {
        delete resHeaders[key];
      },
      status(code) {
        statusCode = code;
        return res;
      },
      json(obj) {
        ensureJson(resHeaders);
        finish(JSON.stringify(obj));
      },
      send(payload) {
        if (payload == null) return finish(null);
        if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) return finish(payload);
        if (typeof payload === 'object') {
          ensureJson(resHeaders);
          return finish(JSON.stringify(payload));
        }
        return finish(String(payload));
      },
      end(payload) {
        finish(payload ?? null);
      },
    };

    Promise.resolve(routeHandler(req, res)).catch((error) => {
      if (settled) return;
      settled = true;
      resolve({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: errMsg(error) }),
      });
    });
  });
}

function respond(version, status, headers, body) {
  if (version === 1) {
    const isBinary = Buffer.isBuffer(body) || body instanceof Uint8Array;
    return {
      statusCode: status,
      headers,
      body: isBinary ? Buffer.from(body).toString('base64') : body ?? '',
      isBase64Encoded: isBinary,
    };
  }
  return new Response(body, { status, headers });
}

/** Crea un handler Netlify a partir de un mapa { '/api/x': () => import(...) }. */
export function createNetlifyHandler(routes) {
  return async function handler(request) {
    try {
      const { version, method, url, headers, rawBody } = await readIncoming(request);
      const path = normalizePath(url.pathname);
      const loadRoute = routes[path];

      if (!loadRoute) {
        return respond(version, 404, { 'Content-Type': 'application/json' },
          JSON.stringify({ error: `Ruta no encontrada: ${path}` }));
      }

      let routeHandler;
      try {
        const mod = await loadRoute();
        routeHandler = mod.default;
      } catch (error) {
        return respond(version, 500, { 'Content-Type': 'application/json' },
          JSON.stringify({ error: `No se pudo cargar ${path}: ${errMsg(error)}` }));
      }

      let body;
      if (rawBody) {
        const contentType = headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            return respond(version, 400, { 'Content-Type': 'application/json' },
              JSON.stringify({ error: 'JSON inválido' }));
          }
        } else {
          body = rawBody;
        }
      }

      const query = {};
      for (const [key, value] of url.searchParams) query[key] = value;

      const req = { method, url: url.pathname + url.search, headers, body, query };
      const result = await runHandler(routeHandler, req);
      return respond(version, result.status, result.headers, result.body);
    } catch (error) {
      const version = request && (request.httpMethod || request.rawUrl) ? 1 : 2;
      return respond(version, 500, { 'Content-Type': 'application/json' },
        JSON.stringify({ error: `Fallo del adaptador: ${errMsg(error)}` }));
    }
  };
}
