import { Hono } from 'hono';
import { getProvider } from '../services/llm/providerRegistry.js';
import { rawQuery } from '@contexta/db';

export const attachmentRoutes = new Hono();

attachmentRoutes.post('/attachments/describe', async (c) => {
  const { mimeType, base64Data, fileName, serverId } = await c.req.json();
  if (!mimeType || !base64Data || !fileName) {
    return c.json({ success: false, error: 'mimeType, base64Data, and fileName are required' }, 400);
  }

  let activeModel = 'gemini-2.5-flash';
  if (serverId) {
    try {
      const result = await rawQuery('SELECT active_model FROM server_settings WHERE server_id = $1', [serverId]);
      if (result.rows.length > 0) activeModel = result.rows[0].active_model || activeModel;
    } catch { /* use default */ }
  }

  const ai = getProvider(activeModel);
  const description = await ai.describeAttachment(mimeType, base64Data, fileName);
  return c.json({ description });
});
