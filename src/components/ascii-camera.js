const CHARS = ' .:@CYBERTWIN';
const COLS = 80;
const ROWS = 40;

export function createAsciiCamera() {
  const pre = document.createElement('pre');
  pre.className = 'ascii-viewport';

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;

  const canvas = document.createElement('canvas');
  canvas.width = COLS;
  canvas.height = ROWS;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const snapCanvas = document.createElement('canvas');

  let rafId = 0;
  let running = false;

  function draw() {
    if (!running) return;

    ctx.drawImage(video, 0, 0, COLS, ROWS);
    const { data } = ctx.getImageData(0, 0, COLS, ROWS);

    let ascii = '';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = (y * COLS + x) * 4;
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const charIdx = Math.floor((brightness / 255) * (CHARS.length - 1));
        ascii += CHARS[charIdx];
      }
      ascii += '\n';
    }

    pre.textContent = ascii;
    rafId = requestAnimationFrame(draw);
  }

  return {
    el: pre,

    start(stream) {
      video.srcObject = stream;
      video.play();
      running = true;
      rafId = requestAnimationFrame(draw);
    },

    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      video.pause();
      video.srcObject = null;
    },

    snapshot() {
      return new Promise((resolve) => {
        if (!video.videoWidth) {
          resolve(null);
          return;
        }
        snapCanvas.width = video.videoWidth;
        snapCanvas.height = video.videoHeight;
        const snapCtx = snapCanvas.getContext('2d');
        snapCtx.drawImage(video, 0, 0);
        snapCanvas.toBlob(
          (b) => resolve(b),
          'image/jpeg',
          0.85,
        );
      });
    },
  };
}
