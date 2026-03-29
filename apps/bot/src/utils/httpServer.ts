import http from 'http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function startHealthServer(): http.Server {
  const port = parseInt(process.env.PORT || '3000', 10);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404, JSON_HEADERS);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`[Bot HTTP] Health server on port ${port}`);
  });

  return server;
}
