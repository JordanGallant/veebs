const MODEL_URL = 'https://fal.run/fal-ai/flux-2/flash/edit';

const CYBORG_PROMPT =
  'make this person into a beautiful yet terrifying cyborg, shiny sharp silver parts. face and demeanor stay perfectly intact. looking directly into the camera, in an intense and charming way. match clothing and style of input image. ensure face of main subject on input stays the same in output. remove the background. ensure the face stays the same as refrence image.';

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

  const { imageDataUrl } = parseBody(req);
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return sendJson(res, 400, { error: 'Missing imageDataUrl.' });
  }

  if (!imageDataUrl.startsWith('data:image/')) {
    return sendJson(res, 400, { error: 'imageDataUrl must be a valid image data URL.' });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Server is missing FAL_KEY.' });
  }

  let falRes;
  try {
    falRes = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: CYBORG_PROMPT,
        image_url: imageDataUrl,
        output_format: 'png',
        safety_tolerance: '2',
      }),
    });
  } catch {
    return sendJson(res, 502, { error: 'Could not reach Fal API.' });
  }

  let falJson = null;
  try {
    falJson = await falRes.json();
  } catch {
    falJson = null;
  }

  if (!falRes.ok) {
    const msg = falJson?.detail || falJson?.error || 'Fal API returned an error.';
    return sendJson(res, falRes.status, { error: String(msg) });
  }

  const imageUrl =
    falJson?.images?.[0]?.url ||
    falJson?.image?.url ||
    falJson?.output?.images?.[0]?.url ||
    null;

  if (!imageUrl) {
    return sendJson(res, 502, { error: 'Fal API response missing output image URL.' });
  }

  return sendJson(res, 200, { imageUrl });
};
