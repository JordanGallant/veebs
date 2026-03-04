const CHARS = " .'`^\" ,:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

export function createAsciiCamera() {
  const pre = document.createElement('pre');
  pre.className = 'ascii-viewport';

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let cols = 80, rows = 40;
  let rafId = 0, running = false;

  function resize() {
    const rect = pre.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const style = window.getComputedStyle(pre);
    const fontSize = parseFloat(style.fontSize) || 10;
    const charW = fontSize * 0.6;
    const lineH = fontSize * 1.2;

    cols = Math.floor(rect.width / charW);
    rows = Math.floor(rect.height / lineH);
    canvas.width = cols;
    canvas.height = rows;
  }

  function draw() {
    if (!running) return;

    ctx.drawImage(video, 0, 0, cols, rows);
    const { data } = ctx.getImageData(0, 0, cols, rows);

    let ascii = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
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
      resize();
      window.addEventListener('resize', resize);
      running = true;
      rafId = requestAnimationFrame(draw);
    },

    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      video.pause();
      video.srcObject = null;
    },

    snapshot() {
      const snap = document.createElement('canvas');
      snap.width = video.videoWidth || 640;
      snap.height = video.videoHeight || 480;
      snap.getContext('2d').drawImage(video, 0, 0);
      return new Promise(r => snap.toBlob(b => r(b), 'image/jpeg', 0.85));
    }
  };
}
