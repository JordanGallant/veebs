const CHARS = '　。一丨二十人三大双中丰内仿电机芯网体码数智械脑像镜链隆螺赛博器';
const HELIX_CHARS = '　。一人机芯智脑镜螺';
const LUMA_BLEND = 0.48;
const LUMA_GAMMA = 0.78;
const DIFF_TRACK_ROWS = 5;
const RAIN_TRAIL = 5;
const MAX_DROPS = 220;
const MAX_SPAWNS = 16;
const SPAWN_CHANCE = 0.82;
const TRANSITION_MS = 1200;
const HELIX_COUNT = 24;
const HELIX_STEP_MS = 100;
const JITTER_CHANCE = 0.12;
const BODY_COUNT = 36;
const BODY_STEP_MS = 140;
const BODY_GLOW = 0.025;

const BODY_PARTS = [
  [0, -0.39, 0.01, 0, -0.39, 0.01, 0.052],
  [0, -0.34, 0.005, 0, -0.30, 0.005, 0.022],
  [-0.09, -0.28, 0, 0.09, -0.28, 0, 0.035],
  [0.09, -0.28, 0, 0.09, -0.28, 0, 0.032],
  [-0.09, -0.28, 0, -0.09, -0.28, 0, 0.032],
  [0, -0.28, 0.02, 0, -0.11, 0.01, 0.085],
  [-0.04, -0.24, 0.035, 0.04, -0.24, 0.035, 0.042],
  [-0.035, -0.17, 0.025, 0.035, -0.17, 0.025, 0.038],
  [0, -0.11, 0.005, 0, 0.02, 0, 0.065],
  [-0.06, 0.0, 0, 0.06, 0.0, 0, 0.042],
  [0.09, -0.28, 0, 0.30, -0.28, 0, 0.025],
  [-0.09, -0.28, 0, -0.30, -0.28, 0, 0.025],
  [0.30, -0.28, 0, 0.30, -0.28, 0, 0.024],
  [-0.30, -0.28, 0, -0.30, -0.28, 0, 0.024],
  [0.30, -0.28, 0, 0.42, -0.24, 0.015, 0.020],
  [-0.30, -0.28, 0, -0.42, -0.24, 0.015, 0.020],
  [0.42, -0.24, 0.01, 0.46, -0.22, 0.01, 0.018],
  [-0.42, -0.24, 0.01, -0.46, -0.22, 0.01, 0.018],
  [0.05, 0.02, 0, 0.12, 0.22, 0, 0.042],
  [-0.05, 0.02, 0, -0.12, 0.22, 0, 0.042],
  [0.12, 0.22, 0, 0.12, 0.22, 0, 0.034],
  [-0.12, 0.22, 0, -0.12, 0.22, 0, 0.034],
  [0.12, 0.22, 0, 0.14, 0.40, 0, 0.028],
  [-0.12, 0.22, 0, -0.14, 0.40, 0, 0.028],
  [0.14, 0.40, 0, 0.18, 0.43, -0.01, 0.022],
  [-0.14, 0.40, 0, -0.18, 0.43, -0.01, 0.022],
];

function detectLightBg() {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;width:0;height:0;background:var(--color-bg)';
  document.body.appendChild(div);
  const bg = getComputedStyle(div).backgroundColor;
  div.remove();
  const m = bg.match(/\d+/g);
  if (!m || m.length < 3) return false;
  return (+m[0] * 0.299 + +m[1] * 0.587 + +m[2] * 0.114) > 128;
}

export function createAsciiCamera(opts = {}) {
  const pre = document.createElement('pre');
  pre.className = 'ascii-viewport';
  const mirror = opts.mirror === true;
  const rainOn = opts.rain === true;

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;

  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d', { willReadFrequently: true });

  let cols = 0, totalRows = 0, camRows = 0, rainRows = 0;
  let phase = 'idle';
  let running = false;
  let rafId = 0;
  let invertLuma = false;

  let smoothed = null;
  let hasPrev = false;
  let prevBand = null;
  let lastBuf = null;

  let drops = [];

  let frozen = null;
  let flipTimes = null;
  let transStart = 0;

  let helixData = null;
  let helixIdx = 0;
  let lastHelixT = 0;

  let bodyData = null;
  let bodyIdx = 0;
  let lastBodyT = 0;

  function measure() {
    const style = window.getComputedStyle(pre);
    const probe = document.createElement('span');
    probe.textContent = '中';
    probe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;white-space:pre;' +
      'font-family:' + style.fontFamily + ';font-size:' + style.fontSize + ';' +
      'font-weight:' + style.fontWeight + ';letter-spacing:' + style.letterSpacing + ';' +
      'line-height:' + style.lineHeight;
    document.body.appendChild(probe);
    const r = probe.getBoundingClientRect();
    probe.remove();
    const fs = parseFloat(style.fontSize) || 10;
    const lh = parseFloat(style.lineHeight);
    return {
      charW: Math.max(1, r.width || fs),
      lineH: Number.isFinite(lh) ? lh : Math.max(1, r.height || fs),
    };
  }

  function resize() {
    const rect = pre.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { charW, lineH } = measure();
    const newCols = Math.max(1, Math.floor(rect.width / charW));
    const newTotal = Math.max(2, Math.floor(rect.height / lineH));
    if (newCols === cols && newTotal === totalRows) return;

    cols = newCols;
    totalRows = newTotal;

    if (rainOn && phase === 'recording') {
      camRows = Math.max(1, Math.floor(totalRows / 2));
      rainRows = totalRows - camRows;
    } else if (phase === 'recording') {
      camRows = totalRows;
      rainRows = 0;
    }

    if (phase !== 'body') {
      cvs.width = cols;
      cvs.height = camRows;
    }
    smoothed = null;
    hasPrev = false;
    prevBand = null;
    helixData = null;
    bodyData = null;
    drops = drops.filter(d => d.x < cols && d.y < rainRows);
    invertLuma = detectLightBg();
  }

  function ensureHelix() {
    if (helixData && helixData[0].length === cols * totalRows) return helixData;
    const last = HELIX_CHARS.length - 1;
    const amp = Math.max(3, Math.floor(cols / 5));
    const cx = cols / 2;
    const rungGap = Math.max(2, Math.floor(totalRows / 8));
    helixData = [];
    for (let f = 0; f < HELIX_COUNT; f++) {
      const frame = new Array(cols * totalRows);
      for (let y = 0; y < totalRows; y++) {
        const t = (y / totalRows) * Math.PI * 6 + (f / HELIX_COUNT) * Math.PI * 2;
        const s1 = Math.sin(t) * amp + cx;
        const s2 = Math.sin(t + Math.PI) * amp + cx;
        const isRung = (y + Math.floor(f * totalRows / HELIX_COUNT)) % rungGap < 1;
        const rL = Math.min(s1, s2);
        const rR = Math.max(s1, s2);
        for (let x = 0; x < cols; x++) {
          const d = Math.min(Math.abs(x - s1), Math.abs(x - s2));
          let ci;
          if (d < 1) ci = last;
          else if (d < 2) ci = Math.floor(last * 0.7);
          else if (d < 3.5) ci = Math.floor(last * 0.4);
          else if (isRung && x > rL + 1 && x < rR - 1) ci = Math.floor(last * 0.25);
          else if (d < 5) ci = Math.floor(last * 0.12);
          else ci = 0;
          frame[y * cols + x] = HELIX_CHARS[ci];
        }
      }
      helixData.push(frame);
    }
    return helixData;
  }

  function ensureBody() {
    if (bodyData && bodyData[0].length === cols * totalRows) return bodyData;
    const cLast = CHARS.length - 1;
    const scale = Math.min(cols, totalRows) * 0.92;
    const halfC = cols / 2;
    const halfR = totalRows / 2;
    bodyData = [];

    for (let f = 0; f < BODY_COUNT; f++) {
      const ang = (f / BODY_COUNT) * Math.PI * 2;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      const rot = BODY_PARTS.map(([ax, ay, az, bx, by, bz, r]) => ({
        ax: ax * cosA - az * sinA,
        ay,
        az: ax * sinA + az * cosA,
        bx: bx * cosA - bz * sinA,
        by,
        bz: bx * sinA + bz * cosA,
        r,
      }));

      const frame = new Array(cols * totalRows);

      for (let cy = 0; cy < totalRows; cy++) {
        const ny = (cy - halfR) / scale;
        for (let cx = 0; cx < cols; cx++) {
          const nx = (cx - halfC) / scale;

          let bestPen = 0;
          let bestGlow = 0;

          for (const p of rot) {
            const dx = p.bx - p.ax;
            const dy = p.by - p.ay;
            const lsq = dx * dx + dy * dy;
            const t = lsq < 1e-8 ? 0 : Math.max(0, Math.min(1, ((nx - p.ax) * dx + (ny - p.ay) * dy) / lsq));
            const px = p.ax + t * dx;
            const py = p.ay + t * dy;
            const d2d = Math.sqrt((nx - px) ** 2 + (ny - py) ** 2);

            if (d2d < p.r) {
              const pen = (p.r - d2d) / p.r;
              if (pen > bestPen) bestPen = pen;
            } else if (d2d < p.r + BODY_GLOW) {
              const g = 1 - (d2d - p.r) / BODY_GLOW;
              if (g > bestGlow) bestGlow = g;
            }
          }

          let ci;
          if (bestPen > 0) {
            ci = Math.max(1, Math.floor((0.25 + 0.75 * bestPen) * cLast));
          } else if (bestGlow > 0) {
            ci = Math.max(1, Math.floor(bestGlow * cLast * 0.18));
          } else {
            ci = 0;
          }
          frame[cy * cols + cx] = CHARS[ci];
        }
      }
      bodyData.push(frame);
    }
    return bodyData;
  }

  function flushBuf(buf) {
    const lines = new Array(totalRows);
    for (let y = 0; y < totalRows; y++) {
      const off = y * cols;
      let line = '';
      for (let x = 0; x < cols; x++) line += buf[off + x];
      lines[y] = line;
    }
    pre.textContent = lines.join('\n');
  }

  function draw(now) {
    if (!running) return;
    if (phase === 'recording') drawRecording();
    else if (phase === 'transition') drawTransition(now);
    else if (phase === 'helix') drawHelix(now);
    else if (phase === 'body') drawBody(now);
    rafId = requestAnimationFrame(draw);
  }

  function drawBody(now) {
    if (!cols || !totalRows) return;
    const frames = ensureBody();
    if (!lastBodyT) lastBodyT = now;
    if (now - lastBodyT >= BODY_STEP_MS) {
      bodyIdx = (bodyIdx + 1) % frames.length;
      lastBodyT = now;
    }
    flushBuf(frames[bodyIdx]);
  }

  function drawRecording() {
    if (!cols || !camRows) return;

    if (mirror) {
      ctx.setTransform(-1, 0, 0, 1, cols, 0);
      ctx.drawImage(video, 0, 0, cols, camRows);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(video, 0, 0, cols, camRows);
    }

    const { data } = ctx.getImageData(0, 0, cols, camRows);
    const camN = cols * camRows;

    if (!smoothed || smoothed.length !== camN) {
      smoothed = new Float32Array(camN);
      hasPrev = false;
    }

    let lo = 255, hi = 0;
    for (let i = 0; i < camN; i++) {
      const p = i * 4;
      const raw = data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722;
      const v = hasPrev ? smoothed[i] + (raw - smoothed[i]) * LUMA_BLEND : raw;
      smoothed[i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    hasPrev = true;

    const range = Math.max(1, hi - lo);
    const cLast = CHARS.length - 1;
    const total = cols * totalRows;
    const buf = new Array(total);

    for (let i = 0; i < camN; i++) {
      const norm = (smoothed[i] - lo) / range;
      const cl = Math.pow(norm, LUMA_GAMMA);
      let ci = Math.floor(cl * cLast);
      if (invertLuma) ci = cLast - ci;
      if (ci > 1 && ci < cLast - 1 && Math.random() < JITTER_CHANCE) {
        ci += Math.random() < 0.5 ? -1 : 1;
      }
      buf[i] = CHARS[ci];
    }

    if (rainOn && rainRows > 0) {
      const tracked = Math.min(DIFF_TRACK_ROWS, camRows);
      const bandN = tracked * cols;
      const nextBand = new Array(bandN);
      let bi = 0, spawns = 0;

      for (let sr = 0; sr < tracked; sr++) {
        const y = camRows - tracked + sr;
        const rs = y * cols;
        for (let x = 0; x < cols; x++) {
          const ch = buf[rs + x];
          nextBand[bi] = ch;
          if (
            prevBand && ch !== prevBand[bi] && ch !== CHARS[0] &&
            spawns < MAX_SPAWNS && drops.length < MAX_DROPS &&
            Math.random() < SPAWN_CHANCE
          ) {
            drops.push({
              char: ch, x,
              y: -(RAIN_TRAIL - 1),
              speed: 0.28 + Math.random() * 0.34,
            });
            spawns++;
          }
          bi++;
        }
      }
      prevBand = nextBand;

      drops = drops.filter(d => { d.y += d.speed; return d.y < rainRows; });

      const rOff = camN;
      for (let i = 0; i < cols * rainRows; i++) buf[rOff + i] = CHARS[0];

      for (const d of drops) {
        const hy = Math.floor(d.y);
        for (let t = 0; t < RAIN_TRAIL; t++) {
          const ry = hy + t;
          if (ry >= 0 && ry < rainRows) buf[rOff + ry * cols + d.x] = d.char;
        }
      }
    }

    lastBuf = buf;
    flushBuf(buf);
  }

  function drawTransition(now) {
    if (!cols || !totalRows) return;
    const progress = Math.min(1, (now - transStart) / TRANSITION_MS);
    const frames = ensureHelix();

    if (!lastHelixT) lastHelixT = now;
    if (now - lastHelixT >= HELIX_STEP_MS) {
      helixIdx = (helixIdx + 1) % frames.length;
      lastHelixT = now;
    }

    const hFrame = frames[helixIdx];
    const n = cols * totalRows;
    const buf = new Array(n);
    for (let i = 0; i < n; i++) {
      buf[i] = progress >= flipTimes[i] ? hFrame[i] : frozen[i];
    }

    flushBuf(buf);

    if (progress >= 1) {
      phase = 'helix';
      frozen = null;
      flipTimes = null;
    }
  }

  function drawHelix(now) {
    if (!cols || !totalRows) return;
    const frames = ensureHelix();

    if (!lastHelixT) lastHelixT = now;
    if (now - lastHelixT >= HELIX_STEP_MS) {
      helixIdx = (helixIdx + 1) % frames.length;
      lastHelixT = now;
    }

    flushBuf(frames[helixIdx]);
  }

  return {
    el: pre,

    startBody() {
      phase = 'body';
      running = true;
      resize();
      window.addEventListener('resize', resize);
      rafId = requestAnimationFrame(draw);
    },

    start(stream) {
      video.srcObject = stream;
      video.play();
      phase = 'recording';
      running = true;
      resize();
      window.addEventListener('resize', resize);
      rafId = requestAnimationFrame(draw);
    },

    beginBirthing() {
      video.pause();
      video.srcObject = null;

      camRows = totalRows;
      rainRows = 0;

      const n = cols * totalRows;
      frozen = lastBuf ? lastBuf.slice() : new Array(n).fill(CHARS[0]);

      flipTimes = new Float32Array(n);
      const cx = cols / 2;
      const cy = totalRows / 2;
      const maxD = Math.sqrt(cx * cx + cy * cy) || 1;
      for (let i = 0; i < n; i++) {
        const x = i % cols;
        const y = Math.floor(i / cols);
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxD;
        flipTimes[i] = d * 0.55 + Math.random() * 0.35;
      }

      ensureHelix();
      helixIdx = 0;
      lastHelixT = 0;
      transStart = performance.now();
      phase = 'transition';
      drops = [];
    },

    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      video.pause();
      video.srcObject = null;
      phase = 'idle';
      smoothed = null;
      hasPrev = false;
      prevBand = null;
      lastBuf = null;
      drops = [];
      frozen = null;
      flipTimes = null;
      helixData = null;
      bodyData = null;
    },

    snapshot() {
      const snap = document.createElement('canvas');
      snap.width = video.videoWidth || 640;
      snap.height = video.videoHeight || 480;
      snap.getContext('2d').drawImage(video, 0, 0);
      return new Promise(r => snap.toBlob(b => r(b), 'image/jpeg', 0.85));
    },
  };
}
