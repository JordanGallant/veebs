const EDIT_MODEL_ID = 'fal-ai/flux-2/flash/edit';
const REMOVE_BG_MODEL_ID = 'fal-ai/imageutils/rembg';

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

async function uploadToSupabaseStorage(imageBuffer, contentType, userId, agentId) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const storagePath = `${userId}/${agentId}.${ext}`;

  const { error } = await supabase.storage
    .from('profile-images')
    .upload(storagePath, imageBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.warn('Supabase storage upload failed:', error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('profile-images')
    .getPublicUrl(storagePath);

  return urlData?.publicUrl || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const { imageDataUrl, userId, agentId } = parseBody(req);
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

  let removeBgResult;
  try {
    removeBgResult = await fal.subscribe(REMOVE_BG_MODEL_ID, {
      input: {
        image_url: editedImageUrl,
      },
    });
  } catch (err) {
    return sendJson(res, 502, { error: `Background removal failed: ${extractError(err)}` });
  }

  const falImageUrl =
    removeBgResult?.data?.image?.url ||
    removeBgResult?.data?.image ||
    removeBgResult?.data?.images?.[0]?.url ||
    null;
  if (!falImageUrl) {
    return sendJson(res, 502, { error: 'Fal background-removal response missing output image URL.' });
  }

  // Fetch the final image so we can upload to Supabase Storage + return base64
  let imageBuffer = null;
  let contentType = 'image/png';
  let imageDataResponse = null;

  try {
    const imageRes = await fetch(falImageUrl);
    if (imageRes.ok) {
      contentType = imageRes.headers.get('content-type') || 'image/png';
      const arr = await imageRes.arrayBuffer();
      imageBuffer = Buffer.from(arr);
      const base64 = imageBuffer.toString('base64');
      imageDataResponse = `data:${contentType};base64,${base64}`;
    }
  } catch {
    imageBuffer = null;
    imageDataResponse = null;
  }

  // Upload to Supabase Storage for a permanent URL
  let permanentUrl = null;
  if (imageBuffer && userId && agentId) {
    try {
      permanentUrl = await uploadToSupabaseStorage(imageBuffer, contentType, userId, agentId);
    } catch (err) {
      console.warn('Could not upload to Supabase Storage:', err.message);
    }
  }

  return sendJson(res, 200, {
    imageUrl: permanentUrl || falImageUrl,
    imageDataUrl: imageDataResponse,
  });
};
