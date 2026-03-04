import { el } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';

const MESSAGES = [
  'Analyzing voice patterns...',
  'Mapping facial features...',
  'Generating personality matrix...',
  'Initializing neural pathways...',
  'Calibrating empathy circuits...',
  'Bootstrapping consciousness...',
];

const HELIX_FRAMES = buildHelixFrames(24);

let frameTimer = 0;
let msgTimer = 0;
let navTimeout = 0;

export function registerBirthing() {
  registerScreen('birthing', {
    render,
    cleanup() {
      clearInterval(frameTimer);
      clearInterval(msgTimer);
      clearTimeout(navTimeout);
    },
  });
}

function buildHelixFrames(count) {
  const frames = [];
  const height = 16;
  const width = 40;
  const chars = '.:+*#@';

  for (let f = 0; f < count; f++) {
    let frame = '';
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        const phase = (y / height) * Math.PI * 4 + (f / count) * Math.PI * 2;
        const strand1 = Math.sin(phase) * (width / 4) + width / 2;
        const strand2 = Math.sin(phase + Math.PI) * (width / 4) + width / 2;

        const d1 = Math.abs(x - strand1);
        const d2 = Math.abs(x - strand2);
        const d = Math.min(d1, d2);

        if (d < 1) {
          line += chars[chars.length - 1];
        } else if (d < 2) {
          line += chars[Math.floor(chars.length * 0.6)];
        } else if (d < 3.5) {
          line += chars[Math.floor(chars.length * 0.3)];
        } else {
          line += ' ';
        }
      }
      frame += line + '\n';
    }
    frames.push(frame);
  }
  return frames;
}

function render(container) {
  const heading = el('h1', { class: 'text-xl bold' }, 'Birthing Your Twin...');

  const asciiPre = el('pre', { class: 'birthing-ascii' });
  asciiPre.textContent = HELIX_FRAMES[0];

  const statusEl = el('p', { class: 'birthing-status' }, MESSAGES[0]);

  const wrapper = el('div', { class: 'screen' }, heading, asciiPre, statusEl);
  container.appendChild(wrapper);

  let frameIdx = 0;
  frameTimer = window.setInterval(() => {
    frameIdx = (frameIdx + 1) % HELIX_FRAMES.length;
    asciiPre.textContent = HELIX_FRAMES[frameIdx];
  }, 100);

  let msgIdx = 0;
  msgTimer = window.setInterval(() => {
    msgIdx = (msgIdx + 1) % MESSAGES.length;
    statusEl.textContent = MESSAGES[msgIdx];
  }, 1200);

  navTimeout = window.setTimeout(() => {
    navigate('dashboard');
  }, 6000);
}
