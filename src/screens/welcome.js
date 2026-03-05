import { el, on } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';

let cam = null;
let revealTimer = 0;
let exitTimer = 0;
let stopBrandType = null;
let stopHeadingType = null;

export function registerWelcome() {
  registerScreen('welcome', {
    render,
    cleanup() {
      if (cam) cam.stop();
      cam = null;
      clearTimeout(revealTimer);
      clearTimeout(exitTimer);
      if (stopBrandType) stopBrandType();
      if (stopHeadingType) stopHeadingType();
      stopBrandType = null;
      stopHeadingType = null;
    },
  });
}

function render(container) {
  cam = createAsciiCamera();

  const brandTitle = el('h1', { class: 'welcome-title' }, '');
  const heading = el('h1', { class: 'text-lg bold welcome-heading' }, '');
  const helpToggle = el('button', {
    class: 'welcome-help-toggle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'welcome-help',
    'aria-label': 'Why is this needed?',
  }, '?');

  const subtitle = el(
    'p',
    { class: 'secondary text-sm welcome-help-text' },
    'CyberTwin needs temporary access to your camera and microphone to capture your appearance and voice. This data creates the foundation for your digital twin.',
  );
  const infoBody = el('div', { class: 'welcome-help-body' }, subtitle);
  const infoWrap = el('div', { class: 'welcome-help-wrap', id: 'welcome-help' }, infoBody);
  const headingRow = el('div', { class: 'welcome-heading-row' }, heading, helpToggle);

  const errorBox = el('p', { class: 'error', style: 'display:none' });

  const btn = el('button', { class: 'btn' }, 'Allow Access');
  const skipBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Continue without cloning');

  on(helpToggle, 'click', () => {
    const isOpen = infoWrap.classList.toggle('is-open');
    helpToggle.setAttribute('aria-expanded', String(isOpen));
  });

  on(btn, 'click', async () => {
    btn.setAttribute('disabled', '');
    skipBtn.setAttribute('disabled', '');
    btn.textContent = 'Requesting access...';
    errorBox.style.display = 'none';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      store.mediaStream = stream;
      panel.classList.remove('is-visible');
      panel.classList.add('is-exiting');
      exitTimer = window.setTimeout(() => {
        store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
        navigate('recording');
      }, 420);
    } catch {
      btn.removeAttribute('disabled');
      skipBtn.removeAttribute('disabled');
      btn.textContent = 'Allow Access';
      errorBox.style.display = '';
      errorBox.textContent =
        'Permission denied. Please allow camera and microphone access in your browser settings and try again.';
    }
  });

  on(skipBtn, 'click', () => {
    store.asciiTransitionBodyTime = null;
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    exitTimer = window.setTimeout(() => {
      navigate('dashboard');
    }, 420);
  });

  const actions = el('div', { class: 'welcome-actions' }, btn, skipBtn);
  const panel = el('div', { class: 'overlay-panel overlay-panel--compact overlay-shell welcome-panel' }, headingRow, infoWrap, errorBox, actions);
  const content = el('div', { class: 'welcome-content' }, brandTitle, panel);

  const wrapper = el(
    'div',
    { class: 'screen welcome-screen' },
    cam.el,
    content,
  );

  container.appendChild(wrapper);
  cam.startBody();
  stopBrandType = animateTypewriter(brandTitle, 'CYBER TWIN', {
    delay: 120,
    speed: 48,
    swap: false,
  });
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Extract Your DNA', {
      delay: 80,
      speed: 26,
      swap: false,
    });
  }, 900);
}
