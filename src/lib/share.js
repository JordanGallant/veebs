import { getAccessToken } from './api.js';

const MAX_X_TEXT_LENGTH = 240;

export async function createShareCard({ agentId, twinName, shareMode, recipientName, sharePrompt }) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('You must be signed in to share your twin.');
  const resolvedShareMode = shareMode || (recipientName || sharePrompt ? 'personal' : 'quick');

  const response = await fetch('https://agents.jgsleepy.xyz/api/share-cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      agentId,
      twinName,
      shareMode: resolvedShareMode,
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
  const response = await fetch(`https://agents.jgsleepy.xyz/api/share-cards?token=${encodeURIComponent(token)}`);

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

export function canUseNativeShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function buildShareBody(text, url) {
  return [text, url].filter(Boolean).join('\n\n');
}

export function prepareShareTarget(channel) {
  if (channel !== 'whatsapp' && channel !== 'x') return null;

  const popup = window.open('', '_blank');
  if (popup) {
    popup.opener = null;
  }
  return popup;
}

export async function shareToChannel(channel, payload, { preparedTarget = null } = {}) {
  switch (channel) {
    case 'whatsapp':
      openExternalUrl(buildWhatsAppUrl(payload), preparedTarget);
      return { message: 'Opened WhatsApp.' };
    case 'x':
      openExternalUrl(buildXUrl(payload), preparedTarget);
      return { message: 'Opened X.' };
    case 'messages':
      openMessagesApp(payload);
      return { message: 'Opened Messages.' };
    case 'copy': {
      const copied = await copySharePayload(payload);
      return { message: copied ? 'Link copied.' : payload.url || 'Could not copy the link.' };
    }
    case 'more':
      return shareWithNativeOrCopy(payload, 'Link copied. Native share is unavailable in this browser.');
    case 'instagram':
      if (canUseNativeShare()) {
        await navigator.share(payload);
        return { message: 'Shared.' };
      }
      return {
        message: await copySharePayload(payload)
          ? 'Instagram sharing is unavailable here. Link copied instead.'
          : (payload.url || 'Instagram sharing is unavailable in this browser.'),
      };
    default:
      throw new Error('Unsupported share target.');
  }
}

async function shareWithNativeOrCopy(payload, fallbackMessage) {
  if (canUseNativeShare()) {
    await navigator.share(payload);
    return { message: 'Shared.' };
  }

  const copied = await copySharePayload(payload);
  return {
    message: copied ? fallbackMessage : (payload.url || 'Could not copy the link.'),
  };
}

function buildWhatsAppUrl(payload) {
  return `https://wa.me/?text=${encodeURIComponent(buildShareBody(payload.text, payload.url))}`;
}

function buildXUrl(payload) {
  const text = truncateXText(payload.text || '');
  const url = payload.url || '';
  const shareUrl = new URL('https://twitter.com/intent/tweet');
  if (text) shareUrl.searchParams.set('text', text);
  if (url) shareUrl.searchParams.set('url', url);
  return shareUrl.toString();
}

function truncateXText(text) {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_X_TEXT_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_X_TEXT_LENGTH - 1).trimEnd()}…`;
}

function openMessagesApp(payload) {
  const separator = /iphone|ipad|ipod/i.test(window.navigator.userAgent) ? '&' : '?';
  const smsUrl = `sms:${separator}body=${encodeURIComponent(buildShareBody(payload.text, payload.url))}`;
  window.location.href = smsUrl;
}

function openExternalUrl(url, preparedTarget = null) {
  if (preparedTarget && !preparedTarget.closed) {
    preparedTarget.location.href = url;
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

async function copySharePayload(payload) {
  const text = buildShareBody(payload.text, payload.url);
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
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
