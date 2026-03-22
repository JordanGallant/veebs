const EDIT_MODEL_ID = 'fal-ai/flux-2/flash/edit';
const { persistExternalProfileImage } = require('./profile-image-storage.js');
const { HttpError, requireAuthenticatedUser } = require('./request-auth.js');

const CYBORG_PROMPT =
  'make this person into a beautiful yet terrifying cyborg, shiny sharp silver parts. face and demeanor stay perfectly intact. looking directly into the camera, in an intense and charming way. match clothing and style of input image. ensure face of main subject on input stays the same in output. use a light purple lavender gradient background. ensure the face stays the same as reference image.';

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

function dataUrlToBuffer(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image data URL.');
  }

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { mimeType, buffer };
}

function extractError(err) {
  const msg =
    err?.body?.detail?.[0]?.msg ||
    err?.body?.detail ||
    err?.body?.error ||
    err?.message ||
    'Fal API returned an error.';
  return String(msg);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const { imageDataUrl, agentId } = parseBody(req);
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return sendJson(res, 400, { error: 'Missing imageDataUrl.' });
  }

  if (!imageDataUrl.startsWith('data:image/')) {
    return sendJson(res, 400, { error: 'imageDataUrl must be a valid image data URL.' });
  }

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

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Server is missing FAL_KEY.' });
  }

  let fal;
  try {
    ({ fal } = await import('@fal-ai/client'));
  } catch {
    return sendJson(res, 500, { error: 'Could not load @fal-ai/client.' });
  }

  fal.config({ credentials: apiKey });

  let editResult;
  try {
    let inputImageUrl = imageDataUrl;
    try {
      const { mimeType, buffer } = dataUrlToBuffer(imageDataUrl);
      const imageBlob = new Blob([buffer], { type: mimeType });
      inputImageUrl = await fal.storage.upload(imageBlob);
    } catch {
      inputImageUrl = imageDataUrl;
    }

    editResult = await fal.subscribe(EDIT_MODEL_ID, {
      input: {
        prompt: CYBORG_PROMPT,
        image_urls: [inputImageUrl],
        output_format: 'png',
        num_images: 1,
        safety_tolerance: 2,
      },
    });
  } catch (err) {
    return sendJson(res, 502, { error: extractError(err) });
  }

  const editedImageUrl = editResult?.data?.images?.[0]?.url || null;
  if (!editedImageUrl) {
    return sendJson(res, 502, { error: 'Fal API response missing output image URL.' });
  }

  const falImageUrl = editedImageUrl;
  if (!falImageUrl) {
    return sendJson(res, 502, { error: 'Fal edit response missing output image URL.' });
  }

  try {
    const persisted = await persistExternalProfileImage({
      imageUrl: falImageUrl,
      userId: user.id,
      agentId,
    });

    return sendJson(res, 200, {
      imageUrl: falImageUrl,
      storagePath: persisted.storagePath,
      imageDataUrl: persisted.imageDataUrl,
    });
  } catch (err) {
    const statusCode = err instanceof HttpError ? err.statusCode : 502;
    return sendJson(res, statusCode, { error: `Could not store portrait in Supabase: ${err.message}` });
  }
};
