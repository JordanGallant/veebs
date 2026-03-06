import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'assets', 'cybertwin.m4v');
const MOBILE_MP4 = path.join(ROOT, 'assets', 'cybertwin-mobile.mp4');
const FALLBACK_BIN = path.join(ROOT, 'assets', 'cybertwin-ascii.bin');

const CHARS = '　。一丨二十人三大双中丰内仿电机芯网体码数智械脑像镜链隆螺赛博器';
const BODY_DETAIL_GAMMA = 0.72;
const BODY_BG_ABS_LUMA_CUTOFF = 18;
const BODY_BG_REL_LUMA_CUTOFF = 0.16;

const WIDTH = 80;
const HEIGHT = 45;
const FPS = 10;

if (!ffmpegPath) {
  throw new Error('ffmpeg-static binary not found');
}

function runFfmpeg(args, opts = {}) {
  const res = spawnSync(ffmpegPath, args, {
    encoding: opts.encoding ?? null,
    maxBuffer: opts.maxBuffer ?? 1024 * 1024 * 512,
  });
  if (res.status !== 0) {
    const stderr = typeof res.stderr === 'string' ? res.stderr : Buffer.from(res.stderr || []).toString('utf8');
    throw new Error(`ffmpeg failed:\n${stderr}`);
  }
  return res;
}

function buildMobileMp4() {
  console.log('Building compatible mobile MP4...');
  runFfmpeg([
    '-y',
    '-i', INPUT,
    '-an',
    '-vf', 'fps=15,scale=640:360:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-crf', '30',
    '-preset', 'veryfast',
    MOBILE_MP4,
  ], { encoding: 'utf8' });
}

function lumaToCharIndex(luma, lo, hi) {
  const cLast = CHARS.length - 1;
  const range = Math.max(1, hi - lo);
  const bgCutoff = Math.max(BODY_BG_ABS_LUMA_CUTOFF, lo + range * BODY_BG_REL_LUMA_CUTOFF);
  const activeRange = Math.max(1, hi - bgCutoff);

  if (luma <= bgCutoff) return 0;

  let norm = (luma - bgCutoff) / activeRange;
  norm = Math.pow(Math.min(1, Math.max(0, norm)), BODY_DETAIL_GAMMA);
  let idx = Math.floor(norm * cLast);
  if (idx < 0) idx = 0;
  if (idx > cLast) idx = cLast;
  return idx;
}

function encodeRle(frame) {
  const chunks = [];
  let i = 0;
  while (i < frame.length) {
    const value = frame[i];
    let run = 1;
    while (i + run < frame.length && frame[i + run] === value && run < 0xffff) run++;
    const entry = Buffer.allocUnsafe(3);
    entry.writeUInt16LE(run, 0);
    entry.writeUInt8(value, 2);
    chunks.push(entry);
    i += run;
  }
  const payload = Buffer.concat(chunks);
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function buildAsciiFallback() {
  console.log('Building precomputed ASCII fallback...');
  const raw = runFfmpeg([
    '-v', 'error',
    '-i', INPUT,
    '-an',
    '-vf', `fps=${FPS},scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=gray`,
    '-f', 'rawvideo',
    'pipe:1',
  ]).stdout;

  const frameSize = WIDTH * HEIGHT;
  const frameCount = Math.floor(raw.length / frameSize);
  if (!frameCount) throw new Error('No frames generated for ASCII fallback');

  const frames = [];
  for (let f = 0; f < frameCount; f++) {
    const start = f * frameSize;
    const src = raw.subarray(start, start + frameSize);

    let lo = 255;
    let hi = 0;
    for (let i = 0; i < src.length; i++) {
      const lum = src[i];
      if (lum < lo) lo = lum;
      if (lum > hi) hi = lum;
    }

    const mapped = Buffer.allocUnsafe(frameSize);
    for (let i = 0; i < src.length; i++) {
      mapped[i] = lumaToCharIndex(src[i], lo, hi);
    }

    frames.push(encodeRle(mapped));
  }

  const fileHeader = Buffer.allocUnsafe(17);
  fileHeader.write('ASCI', 0, 4, 'ascii');
  fileHeader.writeUInt8(1, 4);
  fileHeader.writeUInt16LE(WIDTH, 5);
  fileHeader.writeUInt16LE(HEIGHT, 7);
  fileHeader.writeUInt16LE(FPS, 9);
  fileHeader.writeUInt32LE(frameCount, 11);
  fileHeader.writeUInt16LE(CHARS.length, 15);

  fs.writeFileSync(FALLBACK_BIN, Buffer.concat([fileHeader, ...frames]));
}

function printSizes() {
  const files = [INPUT, MOBILE_MP4, FALLBACK_BIN];
  for (const file of files) {
    const s = fs.statSync(file).size;
    console.log(`${path.basename(file)}: ${(s / 1024).toFixed(1)} KB`);
  }
}

buildMobileMp4();
buildAsciiFallback();
printSizes();
console.log('Done.');
