const { getSupabaseAdmin } = require('./supabase-admin.js');

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

async function downloadExternalImage(imageUrl) {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Image download failed with status ${imageRes.status}.`);
  }

  const contentType = imageRes.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  return {
    buffer,
    contentType,
    imageDataUrl: bufferToDataUrl(buffer, contentType),
  };
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
  if (!/^https?:\/\//.test(imageUrl)) {
    throw new Error('imageUrl must be an absolute URL.');
  }
  if (!userId || !agentId) {
    throw new Error('Missing userId or agentId for portrait storage.');
  }

  const { buffer, contentType, imageDataUrl } = await downloadExternalImage(imageUrl);
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
