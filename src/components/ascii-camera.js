const CHARS = '　。一丨二十人三大双中丰内仿电机芯网体码数智械脑像镜链隆螺赛博器';
const CHARS_IDX = new Map();
for (let i = 0; i < CHARS.length; i++) CHARS_IDX.set(CHARS[i], i);
const HELIX_CHARS = '　。一人机芯智脑镜螺';
const LUMA_BLEND = 0.48;
const LUMA_GAMMA = 0.78;
const DIFF_TRACK_ROWS = 5;
const RAIN_TRAIL_MIN = 4;
const RAIN_TRAIL_MAX = 9;
const RAIN_MOTION_MIN = 10;
const RAIN_SPEED_BASE = 0.22;
const RAIN_SPEED_RANGE = 0.88;
const MAX_DROPS = 750;
const MAX_SPAWNS = 302;
const SPAWN_CHANCE = 0.82;
const WAVE_MAX_HEIGHT = 0.7;
const WAVE_ATTACK = 0.45;
const WAVE_RELEASE = 0.06;
const WAVE_FREQ_1 = 0.09;
const WAVE_FREQ_2 = 0.19;
const WAVE_SPEED = 0.0024;
const TRANSITION_MS = 1200;
const PRINT_IN_MS = 920;
const PRINT_BAND_ROWS = 6;
const PRINT_SPARKLE = 0.42;
const HELIX_COUNT = 24;
const HELIX_STEP_MS = 100;
const JITTER_CHANCE = 0.12;
const BODY_STEP_MS = 82;
const BODY_SAMPLES = 2;
const BODY_MAX_STRETCH_DISTORTION = 1.35;
const CAM_MAX_STRETCH_DISTORTION = BODY_MAX_STRETCH_DISTORTION;
const BODY_BG_ABS_LUMA_CUTOFF = 18;
const BODY_BG_REL_LUMA_CUTOFF = 0.16;
const BODY_DETAIL_GAMMA = 0.72;
const BODY_VIDEO_URL = new URL('../../assets/cybertwin.m4v', import.meta.url).href;

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

  const bodyVideo = document.createElement('video');
  bodyVideo.src = BODY_VIDEO_URL;
  bodyVideo.playsInline = true;
  bodyVideo.muted = true;
  bodyVideo.loop = true;
  bodyVideo.preload = 'auto';

  const bodyCvs = document.createElement('canvas');
  const bodyCtx = bodyCvs.getContext('2d', { willReadFrequently: true });

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

  let audioCtx = null;
  let analyser = null;
  let audioSource = null;
  let audioData = null;
  let smoothVolume = 0;
  let waveOn = false;

  let frozen = null;
  let flipTimes = null;
  let transStart = 0;

  let helixData = null;
  let helixIdx = 0;
  let lastHelixT = 0;

  let bodyBuf = null;
  let blankBodyBuf = null;
  let bodyFailed = false;
  let bodySampleW = 0;
  let bodySampleH = 0;
  let lastBodyT = 0;
  let printInStart = 0;

  bodyVideo.addEventListener('error', () => {
    bodyFailed = true;
  });

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
    bodyBuf = null;
    blankBodyBuf = null;
    bodySampleW = 0;
    bodySampleH = 0;
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

  function ensureBodyVideoPlayback() {
    if (bodyFailed) return;
    if (bodyVideo.readyState < 2 || !bodyVideo.paused) return;
    const playPromise = bodyVideo.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }

  function ensureBlankBody() {
    if (blankBodyBuf && blankBodyBuf.length === cols * totalRows) return blankBodyBuf;
    const n = cols * totalRows;
    blankBodyBuf = new Array(n).fill(CHARS[0]);
    return blankBodyBuf;
  }

  function drawSourceWithAspectPolicy(targetCtx, source, srcW, srcH, dstW, dstH, maxStretch, mirrorX = false) {
    const srcAspect = srcW / srcH;
    const dstAspect = dstW / dstH;
    const distortion = srcAspect > dstAspect ? (srcAspect / dstAspect) : (dstAspect / srcAspect);

    targetCtx.save();
    if (mirrorX) {
      targetCtx.translate(dstW, 0);
      targetCtx.scale(-1, 1);
    }

    if (distortion <= maxStretch) {
      // Fill the viewport first; only crop when stretch distortion gets too high.
      targetCtx.drawImage(source, 0, 0, srcW, srcH, 0, 0, dstW, dstH);
    } else if (srcAspect > dstAspect) {
      const cropW = Math.max(1, Math.floor(srcH * dstAspect));
      const cropX = Math.floor((srcW - cropW) * 0.5);
      targetCtx.drawImage(source, cropX, 0, cropW, srcH, 0, 0, dstW, dstH);
    } else {
      const cropH = Math.max(1, Math.floor(srcW / dstAspect));
      const cropY = Math.floor((srcH - cropH) * 0.5);
      targetCtx.drawImage(source, 0, cropY, srcW, cropH, 0, 0, dstW, dstH);
    }

    targetCtx.restore();
  }

  function buildBodyFrameFromVideo() {
    if (!cols || !totalRows || !bodyCtx || bodyVideo.readyState < 2) return null;

    const sampleW = Math.max(1, cols * BODY_SAMPLES);
    const sampleH = Math.max(1, totalRows * BODY_SAMPLES);
    if (sampleW !== bodySampleW || sampleH !== bodySampleH) {
      bodySampleW = sampleW;
      bodySampleH = sampleH;
      bodyCvs.width = sampleW;
      bodyCvs.height = sampleH;
    }

    bodyCtx.fillStyle = '#000';
    bodyCtx.fillRect(0, 0, sampleW, sampleH);

    const srcW = Math.max(1, bodyVideo.videoWidth || 1);
    const srcH = Math.max(1, bodyVideo.videoHeight || 1);
    drawSourceWithAspectPolicy(
      bodyCtx,
      bodyVideo,
      srcW,
      srcH,
      sampleW,
      sampleH,
      BODY_MAX_STRETCH_DISTORTION,
    );

    const { data } = bodyCtx.getImageData(0, 0, sampleW, sampleH);
    const n = cols * totalRows;
    const luma = new Float32Array(n);

    let i = 0;
    for (let y = 0; y < totalRows; y++) {
      const sy = y * BODY_SAMPLES;
      for (let x = 0; x < cols; x++) {
        const sx = x * BODY_SAMPLES;

        let sum = 0;
        for (let oy = 0; oy < BODY_SAMPLES; oy++) {
          const row = (sy + oy) * sampleW;
          for (let ox = 0; ox < BODY_SAMPLES; ox++) {
            const p = (row + sx + ox) * 4;
            sum += data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722;
          }
        }
        luma[i] = sum / (BODY_SAMPLES * BODY_SAMPLES);
        i++;
      }
    }

    let lo = 255;
    let hi = 0;
    for (let k = 0; k < n; k++) {
      const lum = luma[k];
      if (lum < lo) lo = lum;
      if (lum > hi) hi = lum;
    }

    const range = Math.max(1, hi - lo);
    const bgCutoff = Math.max(BODY_BG_ABS_LUMA_CUTOFF, lo + range * BODY_BG_REL_LUMA_CUTOFF);
    const activeRange = Math.max(1, hi - bgCutoff);
    const cLast = CHARS.length - 1;
    const buf = new Array(n);
    for (let k = 0; k < n; k++) {
      const lum = luma[k];
      if (lum <= bgCutoff) {
        buf[k] = CHARS[0];
        continue;
      }
      let norm = (lum - bgCutoff) / activeRange;
      norm = Math.pow(Math.min(1, Math.max(0, norm)), BODY_DETAIL_GAMMA);
      let ci = Math.floor(norm * cLast);
      if (ci < 0) ci = 0;
      if (ci > cLast) ci = cLast;
      buf[k] = CHARS[ci];
    }
    return buf;
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
    if (phase === 'recording') drawRecording(now);
    else if (phase === 'transition') drawTransition(now);
    else if (phase === 'helix') drawHelix(now);
    else if (phase === 'body') drawBody(now);
    rafId = requestAnimationFrame(draw);
  }

  function drawBody(now) {
    if (!cols || !totalRows) return;

    ensureBodyVideoPlayback();
    if (!lastBodyT || now - lastBodyT >= BODY_STEP_MS) {
      const next = buildBodyFrameFromVideo();
      if (next) bodyBuf = next;
      lastBodyT = now;
    }

    flushBuf(bodyBuf || ensureBlankBody());
  }

  function noise01(x, y, t) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + t * 0.021) * 43758.5453;
    return n - Math.floor(n);
  }

  function applyPrintIn(buf, now) {
    if (!printInStart) return buf;
    const progress = Math.min(1, (now - printInStart) / PRINT_IN_MS);
    if (progress >= 1) {
      printInStart = 0;
      return buf;
    }

    const n = cols * totalRows;
    const out = new Array(n);
    const cLast = CHARS.length - 1;
    const noiseMin = Math.max(1, Math.floor(cLast * 0.45));
    const scanY = progress * (totalRows + PRINT_BAND_ROWS) - PRINT_BAND_ROWS;
    const t = now;

    for (let y = 0; y < totalRows; y++) {
      const depth = scanY - y;
      const row = y * cols;
      for (let x = 0; x < cols; x++) {
        const idx = row + x;
        if (depth >= PRINT_BAND_ROWS) {
          out[idx] = buf[idx];
          continue;
        }
        if (depth <= -1) {
          out[idx] = CHARS[0];
          continue;
        }
        const reveal = Math.min(1, Math.max(0, (depth + 1) / (PRINT_BAND_ROWS + 1)));
        const z = noise01(x, y, t);
        if (z < reveal * (1 - PRINT_SPARKLE)) {
          out[idx] = buf[idx];
        } else {
          const ci = noiseMin + Math.floor(z * (cLast - noiseMin + 1));
          out[idx] = CHARS[ci];
        }
      }
    }
    return out;
  }

  function drawRecording(now) {
    if (!cols || !camRows) return;

    const srcW = Math.max(1, video.videoWidth || cols);
    const srcH = Math.max(1, video.videoHeight || camRows);
    drawSourceWithAspectPolicy(
      ctx,
      video,
      srcW,
      srcH,
      cols,
      camRows,
      CAM_MAX_STRETCH_DISTORTION,
      mirror,
    );

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

      const nextLumaBand = new Float32Array(bandN);
      let bi = 0;
      for (let sr = 0; sr < tracked; sr++) {
        const row = (camRows - tracked + sr) * cols;
        for (let x = 0; x < cols; x++) {
          nextLumaBand[bi++] = smoothed[row + x];
        }
      }

      const candidates = [];
      if (prevBand) {
        for (let i = 0; i < bandN; i++) {
          if (Math.abs(nextLumaBand[i] - prevBand[i]) > RAIN_MOTION_MIN) {
            const x = i % cols;
            const bufIdx = (camRows - tracked + Math.floor(i / cols)) * cols + x;
            const ch = buf[bufIdx];
            if (ch !== CHARS[0]) {
              candidates.push({ ch, x, delta: Math.abs(nextLumaBand[i] - prevBand[i]) });
            }
          }
        }
      }
      prevBand = nextLumaBand;

      const budget = Math.min(MAX_SPAWNS, MAX_DROPS - drops.length);
      const limit = Math.min(candidates.length, budget);
      for (let i = 0; i < limit; i++) {
        const j = i + Math.floor(Math.random() * (candidates.length - i));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        if (Math.random() < SPAWN_CHANCE) {
          const c = candidates[i];
          const delta01 = Math.min(1, c.delta / 80);
          const speed = RAIN_SPEED_BASE + delta01 * RAIN_SPEED_RANGE;
          const trail = RAIN_TRAIL_MIN + Math.round(delta01 * (RAIN_TRAIL_MAX - RAIN_TRAIL_MIN));
          drops.push({
            ci: CHARS_IDX.get(c.ch) || 1,
            x: c.x,
            y: -(trail - 1),
            speed,
            trail,
          });
        }
      }

      drops = drops.filter(d => { d.y += d.speed; return d.y < rainRows; });

      const rOff = camN;
      for (let i = 0; i < cols * rainRows; i++) buf[rOff + i] = CHARS[0];

      if (waveOn && analyser && audioData) {
        analyser.getByteTimeDomainData(audioData);
        let sum = 0;
        for (let k = 0; k < audioData.length; k++) {
          const v = (audioData[k] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / audioData.length);
        const vol = Math.min(1, rms * 5.5);
        const rate = vol > smoothVolume ? WAVE_ATTACK : WAVE_RELEASE;
        smoothVolume += (vol - smoothVolume) * rate;

        if (smoothVolume > 0.02) {
          const maxH = Math.floor(rainRows * WAVE_MAX_HEIGHT);
          const t = performance.now();
          for (let x = 0; x < cols; x++) {
            const w1 = Math.sin(x * WAVE_FREQ_1 + t * WAVE_SPEED);
            const w2 = Math.sin(x * WAVE_FREQ_2 - t * WAVE_SPEED * 1.3);
            const h = Math.max(0, Math.floor(smoothVolume * maxH * (1 + w1 * 0.3 + w2 * 0.2)));
            for (let dy = 0; dy < h && dy < rainRows; dy++) {
              const ry = rainRows - 1 - dy;
              const fade = 1 - dy / h;
              const ci = Math.max(1, Math.round(cLast * smoothVolume * fade));
              buf[rOff + ry * cols + x] = CHARS[ci];
            }
          }
        }
      }

      for (const d of drops) {
        const hy = Math.floor(d.y);
        for (let t = 0; t < d.trail; t++) {
          const ry = hy + t;
          if (ry >= 0 && ry < rainRows) {
            const fade = t / Math.max(1, d.trail - 1);
            const fci = Math.max(1, Math.round(d.ci * fade));
            buf[rOff + ry * cols + d.x] = CHARS[fci];
          }
        }
      }
    }

    const out = applyPrintIn(buf, now);
    lastBuf = out;
    flushBuf(out);
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
      printInStart = 0;
      bodyBuf = null;
      blankBodyBuf = null;
      lastBodyT = 0;
      try { bodyVideo.currentTime = 0; } catch {}
      ensureBodyVideoPlayback();
      resize();
      window.addEventListener('resize', resize);
      rafId = requestAnimationFrame(draw);
    },

    start(stream) {
      bodyVideo.pause();
      video.srcObject = stream;
      video.play();
      phase = 'recording';
      running = true;
      printInStart = performance.now();
      if (rainOn && !audioCtx) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          audioSource = audioCtx.createMediaStreamSource(stream);
          audioSource.connect(analyser);
          audioData = new Uint8Array(analyser.fftSize);
        } catch {
          audioCtx = null;
          analyser = null;
          audioSource = null;
          audioData = null;
        }
      }
      resize();
      window.addEventListener('resize', resize);
      rafId = requestAnimationFrame(draw);
    },

    beginBirthing() {
      video.pause();
      video.srcObject = null;
      bodyVideo.pause();
      if (audioSource) audioSource.disconnect();
      if (audioCtx) audioCtx.close().catch(() => {});
      audioCtx = null;
      analyser = null;
      audioSource = null;
      audioData = null;
      smoothVolume = 0;

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
      printInStart = 0;
      drops = [];
    },

    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      video.pause();
      video.srcObject = null;
      bodyVideo.pause();
      if (audioSource) audioSource.disconnect();
      if (audioCtx) audioCtx.close().catch(() => {});
      audioCtx = null;
      analyser = null;
      audioSource = null;
      audioData = null;
      smoothVolume = 0;
      phase = 'idle';
      smoothed = null;
      hasPrev = false;
      prevBand = null;
      lastBuf = null;
      drops = [];
      frozen = null;
      flipTimes = null;
      helixData = null;
      bodyBuf = null;
      blankBodyBuf = null;
      printInStart = 0;
    },

    setWave(on) { waveOn = on; if (!on) smoothVolume = 0; },

    snapshot() {
      const snap = document.createElement('canvas');
      snap.width = video.videoWidth || 640;
      snap.height = video.videoHeight || 480;
      snap.getContext('2d').drawImage(video, 0, 0);
      return new Promise(r => snap.toBlob(b => r(b), 'image/jpeg', 0.85));
    },
  };
}
