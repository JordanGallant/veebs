import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';

let cam = null;
let revealTimer = 0;
let verifyTimer = 0;
let navTimer = 0;
let stopHeadingType = null;

export function registerVerifyEmail() {
  registerScreen('verify-email', {
    render,
    cleanup() {
      if (cam) {
        cam.stop();
        if (cam.el.parentNode) cam.el.parentNode.removeChild(cam.el);
      }
      cam = null;
      clearTimeout(revealTimer);
      clearTimeout(verifyTimer);
      clearTimeout(navTimer);
      if (stopHeadingType) stopHeadingType();
      stopHeadingType = null;
    },
  });
}

function render(container) {
  if (!store.selectedPlan) {
    navigate('welcome');
    return;
  }

  cam = createAsciiCamera({
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-lg bold pricing-heading' }, '');
  const subtitle = el(
    'p',
    { class: 'secondary text-sm' },
    'Enter the code sent to your email to confirm your account.',
  );

  const codeInput = el('input', {
    class: 'input verify-code',
    type: 'text',
    inputmode: 'numeric',
    maxlength: '6',
    placeholder: '000000',
    autocomplete: 'one-time-code',
  });
  const confirmBtn = el('button', { class: 'btn', type: 'button', disabled: '' }, 'Confirm email');
  const status = el('p', { class: 'secondary text-sm pricing-status' });

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-shell verify-panel' },
    heading,
    subtitle,
    codeInput,
    confirmBtn,
    status,
  );
  const content = el('div', { class: 'recording-content' }, panel);
  const wrapper = el('div', { class: 'screen recording-screen' }, content);

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  on(codeInput, 'input', () => {
    const sanitized = codeInput.value.replace(/\D/g, '').slice(0, 6);
    codeInput.value = sanitized;
    if (sanitized.length === 6) {
      confirmBtn.removeAttribute('disabled');
      status.textContent = '';
    } else {
      confirmBtn.setAttribute('disabled', '');
    }
  });

  on(confirmBtn, 'click', () => {
    if (codeInput.value.length !== 6) return;
    confirmBtn.setAttribute('disabled', '');
    codeInput.setAttribute('disabled', '');
    status.textContent = 'Confirming email...';
    verifyTimer = window.setTimeout(() => {
      panel.classList.remove('is-visible');
      panel.classList.add('is-exiting');
      navTimer = window.setTimeout(() => {
        navigate('dashboard');
      }, 420);
    }, 700);
  });

  container.appendChild(wrapper);
  cam.startBody();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Confirm your email', {
      speed: 24,
      swap: false,
    });
  }, 280);
}
