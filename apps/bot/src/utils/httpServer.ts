import http from 'http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function startHealthServer(): http.Server {
  const port = parseInt(process.env.PORT || '6005', 10);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404, JSON_HEADERS);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Bot HTTP] Port ${port} is already in use. Health server failed to start.`);
    } else {
      console.error('[Bot HTTP] Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`[Bot HTTP] Health server on port ${port}`);
  });

  return server;
}
