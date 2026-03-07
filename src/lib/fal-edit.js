function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read snapshot image.'));
    reader.readAsDataURL(blob);
  });
}

export async function createCyborgPortraitFromSnapshot(snapshotBlob) {
  const imageDataUrl = await blobToDataUrl(snapshotBlob);

  const res = await fetch('/api/fal-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl }),
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

  if (!payload?.imageUrl) {
    throw new Error('Fal edit response did not include an image URL.');
  }

  const editedRes = await fetch(payload.imageUrl);
  if (!editedRes.ok) {
    throw new Error('Could not download generated portrait image.');
  }

  return editedRes.blob();
}
