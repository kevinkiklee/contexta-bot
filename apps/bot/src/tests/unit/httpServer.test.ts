import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import http from 'http';
import { createRequestHandler, type HttpServerDeps } from '../../utils/httpServer.js';

describe('HTTP request handler', () => {
  let handler: ReturnType<typeof createRequestHandler>;
  let mockWorker: Mock<HttpServerDeps['runWorker']>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorker = vi.fn().mockResolvedValue({
      status: 'completed',
      channelsProcessed: 2,
      embeddingsCreated: 2,
      errors: [],
    });
    handler = createRequestHandler({ cronSecret: 'test-secret', runWorker: mockWorker });
  });

  function mockReqRes(method: string, url: string, headers: Record<string, string> = {}) {
    const req = { method, url, headers } as http.IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as http.ServerResponse;
    return { req, res };
  }

  it('returns 200 on GET /health', async () => {
    const { req, res } = mockReqRes('GET', '/health');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
  });

  it('returns 404 on unknown routes', async () => {
    const { req, res } = mockReqRes('GET', '/unknown');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('returns 401 when cron secret is missing', async () => {
    const { req, res } = mockReqRes('POST', '/cron/embeddings');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    expect(mockWorker).not.toHaveBeenCalled();
  });

  it('returns 401 when cron secret is wrong', async () => {
    const { req, res } = mockReqRes('POST', '/cron/embeddings', {
      authorization: 'Bearer wrong-secret',
    });
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    expect(mockWorker).not.toHaveBeenCalled();
  });

  it('calls worker and returns stats on valid cron request', async () => {
    const { req, res } = mockReqRes('POST', '/cron/embeddings', {
      authorization: 'Bearer test-secret',
    });
    await handler(req, res);
    expect(mockWorker).toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = JSON.parse((res.end as any).mock.calls[0][0]);
    expect(body.status).toBe('completed');
    expect(body.channelsProcessed).toBe(2);
  });

  it('returns 500 when worker throws', async () => {
    mockWorker.mockRejectedValue(new Error('Worker crashed'));
    const { req, res } = mockReqRes('POST', '/cron/embeddings', {
      authorization: 'Bearer test-secret',
    });
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
  });

  it('returns 405 on non-POST to /cron/embeddings', async () => {
    const { req, res } = mockReqRes('GET', '/cron/embeddings');
    await handler(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
  });
});
