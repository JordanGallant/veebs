const { persistExternalProfileImage } = require('./profile-image-storage.js');
const { HttpError, requireAuthenticatedUser } = require('./request-auth.js');

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
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

  const { imageUrl, agentId } = parseBody(req);
  if (!agentId) {
    return sendJson(res, 400, { error: 'Missing agentId for portrait storage.' });
  }

  let user;
  try {
    ({ user } = await requireAuthenticatedUser(req));
  } catch (err) {
    const statusCode = err instanceof HttpError ? err.statusCode : 500;
    return sendJson(res, statusCode, { error: err.message || 'Unauthorized.' });
  }

  try {
    const persisted = await persistExternalProfileImage({
      imageUrl,
      userId: user.id,
      agentId,
    });
    return sendJson(res, 200, persisted);
  } catch (err) {
    const statusCode = err instanceof HttpError ? err.statusCode : 502;
    return sendJson(res, statusCode, { error: err.message || 'Could not store image in Supabase.' });
  }
};
