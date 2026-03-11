export async function createShareCard({ agentId, twinName, recipientName, sharePrompt }) {
  const response = await fetch('/api/share-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      twinName,
      recipientName,
      sharePrompt,
    }),
  });

  const payload = await parseJsonResponse(response, 'Could not create share card.');

  if (!response.ok) {
    throw new Error(payload?.error || 'Could not create share card.');
  }

  const token = getTokenFromPayload(payload);
  if (!token) {
    throw new Error('Share API did not return a token. Restart the local server and try again.');
  }

  return {
    ...payload,
    token,
  };
}

export async function fetchSharedCard(token) {
  const response = await fetch(`/api/share-cards?token=${encodeURIComponent(token)}`);

  const payload = await parseJsonResponse(response, 'Could not load shared card.');

  if (!response.ok) {
    throw new Error(payload?.error || 'Could not load shared card.');
  }

  return payload;
}

export function buildPublicShareUrl(token) {
  return new URL(`/share/${encodeURIComponent(token)}`, window.location.origin).toString();
}

export function buildWelcomeUrl() {
  const url = new URL(window.location.pathname || '/', window.location.origin);
  url.hash = 'welcome';
  return url.toString();
}

async function parseJsonResponse(response, fallbackMessage) {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    if (raw.startsWith('<!DOCTYPE html>')) {
      throw new Error('Share API is not active. Restart the local server and try again.');
    }
    throw new Error(fallbackMessage);
  }
}

function getTokenFromPayload(payload) {
  if (payload?.token) return payload.token;
  if (typeof payload?.sharePath === 'string') {
    const hashIndex = payload.sharePath.indexOf('#');
    const hash = hashIndex >= 0 ? payload.sharePath.slice(hashIndex + 1) : payload.sharePath;
    const [, query = ''] = hash.split('?');
    return new URLSearchParams(query).get('token');
  }
  return null;
}
