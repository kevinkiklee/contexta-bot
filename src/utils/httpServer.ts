import http from 'http';

export interface HttpServerDeps {
  cronSecret: string;
  runWorker: () => Promise<{
    status: string;
    channelsProcessed: number;
    embeddingsCreated: number;
    errors: string[];
  }>;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function createRequestHandler(deps: HttpServerDeps) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const { method, url, headers } = req;

    if (method === 'GET' && url === '/health') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url === '/cron/embeddings') {
      if (method !== 'POST') {
        res.writeHead(405, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const authHeader = headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${deps.cronSecret}`) {
        res.writeHead(401, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      try {
        const stats = await deps.runWorker();
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify(stats));
      } catch (err) {
        console.error('[HTTP] Worker error:', err);
        res.writeHead(500, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Worker failed', message: (err as Error).message }));
      }
      return;
    }

    res.writeHead(404, JSON_HEADERS);
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}

export function startHttpServer(deps: HttpServerDeps): http.Server {
  const handler = createRequestHandler(deps);
  const port = parseInt(process.env.PORT || '3000', 10);
  const server = http.createServer((req, res) => {
    handler(req, res).catch(err => {
      console.error('[HTTP] Unhandled error:', err);
      res.writeHead(500, JSON_HEADERS);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  });

  server.listen(port, () => {
    console.log(`[HTTP] Server listening on port ${port}`);
  });

  return server;
}
