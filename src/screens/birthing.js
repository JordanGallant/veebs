import { el } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';

const BIRTHING_MESSAGES = [
  'Analyzing voice patterns...',
  'Mapping facial features...',
  'Generating personality matrix...',
  'Initializing neural pathways...',
  'Calibrating empathy circuits...',
  'Bootstrapping consciousness...',
];

let cam = null;
let revealTimer = 0;
let startTimer = 0;
let msgTimer = 0;
let navTimer = 0;
let exitTimer = 0;
let stopHeadingType = null;

export function registerBirthing() {
  registerScreen('birthing', {
    render,
    cleanup() {
      if (cam) {
        cam.stop();
        if (cam.el.parentNode) cam.el.parentNode.removeChild(cam.el);
      }
      cam = null;
      clearTimeout(revealTimer);
      clearTimeout(startTimer);
      clearInterval(msgTimer);
      clearTimeout(navTimer);
      clearTimeout(exitTimer);
      if (stopHeadingType) stopHeadingType();
      stopHeadingType = null;
    },
  });
}

function render(container) {
  if (!store.pendingTwinBirth) {
    navigate('welcome');
    return;
  }

  cam = createAsciiCamera({
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-xl bold birthing-heading' }, '');
  const status = el('p', { class: 'birthing-status' }, BIRTHING_MESSAGES[0]);
  const panel = el('div', { class: 'overlay-panel overlay-panel--compact overlay-shell' }, heading, status);
  const content = el('div', { class: 'birthing-content' }, panel);
  const wrapper = el('div', { class: 'screen recording-screen' }, content);

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  container.appendChild(wrapper);
  cam.startBody();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Birthing Your Twin...', {
      speed: 30,
      swap: false,
    });
  }, 300);

  startTimer = window.setTimeout(() => {
    if (cam) cam.beginBirthing();
  }, 520);

  let msgIdx = 0;
  msgTimer = window.setInterval(() => {
    msgIdx = (msgIdx + 1) % BIRTHING_MESSAGES.length;
    status.textContent = BIRTHING_MESSAGES[msgIdx];
  }, 1200);

  navTimer = window.setTimeout(() => {
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    exitTimer = window.setTimeout(() => {
      store.pendingTwinBirth = false;
      navigate('verify-email');
    }, 420);
  }, 5600);
}
