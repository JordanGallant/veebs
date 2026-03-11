const crypto = require('crypto');
const { getSupabaseAdmin } = require('./supabase-admin.js');
const { HttpError, requireAuthenticatedUser, getOwnedAgentOrThrow } = require('./request-auth.js');

const PROFILE_IMAGE_BUCKET = 'profile-images';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (!req.body) return {};
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function buildSharePath(token) {
  return `/share/${encodeURIComponent(token)}`;
}

function toStoredString(value) {
  return normalizeString(value) || '';
}

function buildQuickShareMessage({ twinName, ownerReferenceName }) {
  const name = twinName || 'My Twin';
  const ownerName = ownerReferenceName || 'my human';
  return `Hi, I'm ${name}, ${ownerName}'s twin.`;
}

function buildPersonalShareMessage({ twinName, ownerReferenceName, recipientName, sharePrompt }) {
  const name = twinName || 'My Twin';
  const ownerName = ownerReferenceName || 'my human';
  const recipient = recipientName || 'there';
  const prompt = sharePrompt || 'I wanted to share my twin with you.';
  return `Hi ${recipient}, I'm ${name}, ${ownerName}'s twin. ${prompt}`;
}

async function getAgentRecord(supabase, agentId, userId) {
  return getOwnedAgentOrThrow(
    supabase,
    agentId,
    userId,
    'id, user_id, name, profile_image_url',
  );
}

async function getOwnerReferenceName(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('owner_reference_name, display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Could not load profile.');
  }

  const ownerReferenceName = normalizeString(data?.owner_reference_name);
  if (ownerReferenceName) return ownerReferenceName;

  const displayName = normalizeString(data?.display_name);
  if (displayName && displayName !== 'CyberTwin User') return displayName;

  return null;
}

async function createShareCard(supabase, {
  agentId,
  twinName,
  profileImageSource,
  recipientName,
  sharePrompt,
  personalMessage,
}) {
  const storedRecipientName = toStoredString(recipientName);
  const storedSharePrompt = toStoredString(sharePrompt);
  const storedPersonalMessage = toStoredString(personalMessage);

  const { data, error } = await supabase
    .from('share_cards')
    .insert({
      agent_id: agentId,
      twin_name: twinName,
      profile_image_source: profileImageSource,
      share_token: crypto.randomUUID().replace(/-/g, ''),
      recipient_name: storedRecipientName,
      share_prompt: storedSharePrompt,
      personal_message: storedPersonalMessage,
    })
    .select(
      'share_token, twin_name, profile_image_source, recipient_name, share_prompt, personal_message',
    )
    .single();

  if (error) {
    throw new Error(error.message || 'Could not create share card.');
  }

  return data;
}

async function fetchShareCard(supabase, token) {
  const { data, error } = await supabase
    .from('share_cards')
    .select('share_token, twin_name, profile_image_source, recipient_name, share_prompt, personal_message')
    .eq('share_token', token)
    .single();

  if (error) {
    throw new Error(error.code === 'PGRST116'
      ? 'Shared card not found.'
      : (error.message || 'Could not load shared card.'));
  }

  return data;
}

async function resolveImageUrl(supabase, profileImageSource) {
  const source = normalizeString(profileImageSource);
  if (!source) return null;
  if (/^https?:\/\//.test(source)) return source;

  const { data, error } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .createSignedUrl(source, 60 * 60 * 24 * 7);

  if (error) {
    throw new Error(error.message || 'Could not sign shared image.');
  }

  return data?.signedUrl || null;
}

module.exports = async function shareCardsHandler(req, res) {
  let supabase;
  try {
    supabase = await getSupabaseAdmin();
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Server is missing Supabase credentials.' });
    return;
  }

  try {
    if (req.method === 'POST') {
      const { user } = await requireAuthenticatedUser(req);
      const body = parseBody(req);
      const agentId = normalizeString(body.agentId);
      const requestedShareMode = normalizeString(body.shareMode);
      const fallbackShareMode = normalizeString(body.recipientName) || normalizeString(body.sharePrompt)
        ? 'personal'
        : 'quick';
      const shareMode = requestedShareMode || fallbackShareMode;
      if (!agentId) {
        sendJson(res, 400, { error: 'Missing agentId.' });
        return;
      }
      if (shareMode !== 'quick' && shareMode !== 'personal') {
        sendJson(res, 400, { error: 'Invalid shareMode.' });
        return;
      }

      const agent = await getAgentRecord(supabase, agentId, user.id);
      const twinName = normalizeString(body.twinName) || normalizeString(agent.name) || 'Unnamed Twin';
      const profileImageSource = normalizeString(agent.profile_image_url);
      const ownerReferenceName = await getOwnerReferenceName(supabase, user.id);
      const recipientName = shareMode === 'personal' ? normalizeString(body.recipientName) : null;
      const sharePrompt = shareMode === 'personal' ? normalizeString(body.sharePrompt) : null;
      if (shareMode === 'personal' && (!recipientName || !sharePrompt)) {
        sendJson(res, 400, { error: 'Missing recipientName or sharePrompt.' });
        return;
      }

      const personalMessage = shareMode === 'quick'
        ? buildQuickShareMessage({ twinName, ownerReferenceName })
        : buildPersonalShareMessage({ twinName, ownerReferenceName, recipientName, sharePrompt });

      const shareCard = await createShareCard(supabase, {
        agentId,
        twinName,
        profileImageSource,
        recipientName,
        sharePrompt,
        personalMessage,
      });
      const imageUrl = await resolveImageUrl(supabase, shareCard.profile_image_source);

      sendJson(res, 200, {
        token: shareCard.share_token,
        twinName: shareCard.twin_name,
        imageUrl,
        recipientName: shareCard.recipient_name,
        sharePrompt: shareCard.share_prompt,
        personalMessage: shareCard.personal_message,
        sharePath: buildSharePath(shareCard.share_token),
      });
      return;
    }

    if (req.method === 'GET') {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      const token = normalizeString(reqUrl.searchParams.get('token'));
      if (!token) {
        sendJson(res, 400, { error: 'Missing token.' });
        return;
      }

      const shareCard = await fetchShareCard(supabase, token);
      const imageUrl = await resolveImageUrl(supabase, shareCard.profile_image_source);

      sendJson(res, 200, {
        token: shareCard.share_token,
        twinName: shareCard.twin_name,
        imageUrl,
        recipientName: shareCard.recipient_name,
        sharePrompt: shareCard.share_prompt,
        personalMessage: shareCard.personal_message,
        sharePath: buildSharePath(shareCard.share_token),
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (err) {
    const message = err.message || 'Unexpected server error.';
    const statusCode = err instanceof HttpError
      ? err.statusCode
      : (message === 'Shared card not found.' ? 404 : 500);
    sendJson(res, statusCode, { error: message });
  }
};
