const { getSupabaseAdmin } = require('./supabase-admin.js');

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function requireAuthenticatedUser(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw new HttpError(401, 'Authorization required.');
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new HttpError(401, 'Invalid or expired session.');
  }

  return {
    supabase,
    user: data.user,
  };
}

async function getOwnedAgentOrThrow(supabase, agentId, userId, select = 'id, user_id') {
  const { data, error } = await supabase
    .from('agents')
    .select(select)
    .eq('id', agentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new HttpError(404, 'Twin not found.');
    }
    throw new Error(error.message || 'Could not load twin.');
  }

  if (data.user_id !== userId) {
    throw new HttpError(403, 'You do not have access to this twin.');
  }

  return data;
}

module.exports = {
  HttpError,
  requireAuthenticatedUser,
  getOwnedAgentOrThrow,
};
