const { persistExternalProfileImage } = require('./profile-image-storage.js');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const { imageUrl, userId, agentId } = parseBody(req);

  try {
    const persisted = await persistExternalProfileImage({ imageUrl, userId, agentId });
    return sendJson(res, 200, persisted);
  } catch (err) {
    return sendJson(res, 502, { error: err.message || 'Could not store image in Supabase.' });
  }
};
