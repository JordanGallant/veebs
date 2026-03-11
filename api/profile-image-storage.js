const { getSupabaseAdmin } = require('./supabase-admin.js');
const { getOwnedAgentOrThrow } = require('./request-auth.js');
const dns = require('dns').promises;
const net = require('net');

const MAX_REDIRECTS = 3;

function bufferToDataUrl(buffer, contentType) {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

function extensionForContentType(contentType, fallback = 'jpg') {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return fallback;
}

function normalizeHostname(hostname) {
  const raw = String(hostname || '').trim().toLowerCase();
  if (!raw) return '';
  const noBrackets = raw.startsWith('[') && raw.endsWith(']')
    ? raw.slice(1, -1)
    : raw;
  return noBrackets.replace(/\.$/, '');
}

function isPrivateIpv4(address) {
  const normalized = String(address || '').toLowerCase();
  if (!normalized) return true;
  if (/^0\./.test(normalized)) return true;
  if (/^127\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^169\.254\./.test(normalized)) return true;

  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const octet = Number(match172[1]);
    if (octet >= 16 && octet <= 31) return true;
  }

  return false;
}

function isPrivateIpv6(address) {
  const normalized = normalizeHostname(address);
  if (!normalized) return true;
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIP(mapped) === 4) {
      return isPrivateIpv4(mapped);
    }
  }

  return false;
}

function isPrivateHostLiteral(hostname) {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized.endsWith('.local')) return true;

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);

  return false;
}

async function assertPublicHost(hostname) {
  const normalized = normalizeHostname(hostname);
  if (isPrivateHostLiteral(normalized)) {
    throw new Error('imageUrl must point to a public host.');
  }

  let resolved;
  try {
    resolved = await dns.lookup(normalized, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not resolve image host.');
  }

  if (!Array.isArray(resolved) || resolved.length === 0) {
    throw new Error('Could not resolve image host.');
  }

  for (const entry of resolved) {
    const version = entry?.family || net.isIP(entry?.address || '');
    if (version === 4 && isPrivateIpv4(entry.address)) {
      throw new Error('imageUrl must point to a public host.');
    }
    if (version === 6 && isPrivateIpv6(entry.address)) {
      throw new Error('imageUrl must point to a public host.');
    }
  }
}

function parseAndValidateExternalUrl(input) {
  let parsedUrl;
  try {
    parsedUrl = new URL(input);
  } catch {
    throw new Error('imageUrl must be an absolute URL.');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('imageUrl must use HTTPS.');
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('imageUrl cannot include credentials.');
  }

  return parsedUrl;
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400;
}

async function downloadExternalImage(imageUrl) {
  let currentUrl = parseAndValidateExternalUrl(imageUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicHost(currentUrl.hostname);

    const imageRes = await fetch(currentUrl, { redirect: 'manual' });
    if (isRedirectStatus(imageRes.status)) {
      const location = imageRes.headers.get('location');
      if (!location) {
        throw new Error(`Image download redirect missing location (status ${imageRes.status}).`);
      }
      if (redirects === MAX_REDIRECTS) {
        throw new Error('Too many redirects while downloading image.');
      }
      currentUrl = parseAndValidateExternalUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!imageRes.ok) {
      throw new Error(`Image download failed with status ${imageRes.status}.`);
    }

    const contentType = imageRes.headers.get('content-type') || 'image/png';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error('Downloaded file is not an image.');
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return {
      buffer,
      contentType,
      imageDataUrl: bufferToDataUrl(buffer, contentType),
    };
  }

  throw new Error('Too many redirects while downloading image.');
}

async function uploadProfileImage(buffer, contentType, userId, agentId) {
  const supabase = await getSupabaseAdmin();
  const ext = extensionForContentType(contentType, 'png');
  const storagePath = `${userId}/${agentId}.${ext}`;

  const { error } = await supabase.storage
    .from('profile-images')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

async function persistExternalProfileImage({ imageUrl, userId, agentId }) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Missing imageUrl.');
  }

  const parsedUrl = parseAndValidateExternalUrl(imageUrl);
  await assertPublicHost(parsedUrl.hostname);
  if (!userId || !agentId) {
    throw new Error('Missing userId or agentId for portrait storage.');
  }

  const supabase = await getSupabaseAdmin();
  await getOwnedAgentOrThrow(supabase, agentId, userId, 'id, user_id');

  const { buffer, contentType, imageDataUrl } = await downloadExternalImage(parsedUrl.toString());
  const storagePath = await uploadProfileImage(buffer, contentType, userId, agentId);

  return {
    storagePath,
    imageDataUrl,
    contentType,
  };
}

module.exports = {
  persistExternalProfileImage,
};
