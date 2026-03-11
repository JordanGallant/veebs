import { store } from './store.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read snapshot image.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then((r) => {
    if (!r.ok) throw new Error('Could not decode generated image payload.');
    return r.blob();
  });
}

async function persistExternalPortrait(imageUrl) {
  const res = await fetch('/api/store-profile-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl,
      userId: store.user?.id || null,
      agentId: store.agentId || null,
    }),
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || 'Could not store generated portrait.');
  }

  return payload;
}

export async function createCyborgPortraitFromSnapshot(snapshotBlob) {
  const imageDataUrl = await blobToDataUrl(snapshotBlob);

  const res = await fetch('/api/fal-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl,
      userId: store.user?.id || null,
      agentId: store.agentId || null,
    }),
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || 'Fal edit request failed.');
  }

  if (!payload?.storagePath && payload?.imageUrl) {
    payload = {
      ...payload,
      ...await persistExternalPortrait(payload.imageUrl),
    };
  }

  if (!payload?.storagePath) {
    throw new Error('Fal edit response did not include a stored portrait path.');
  }

  if (payload.imageDataUrl && typeof payload.imageDataUrl === 'string') {
    const blob = await dataUrlToBlob(payload.imageDataUrl);
    return {
      blob,
      imageUrl: payload.imageUrl || null,
      storagePath: payload.storagePath,
    };
  }

  return {
    blob: null,
    imageUrl: payload.imageUrl || null,
    storagePath: payload.storagePath,
  };
}
