import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';
import { register, login } from '../lib/api.js';

let cam = null;
let revealTimer = 0;
let exitTimer = 0;
let stopHeadingType = null;

export function registerAuth() {
  registerScreen('auth', {
    render,
    cleanup() {
      if (cam) {
        cam.stop();
        if (cam.el.parentNode) cam.el.parentNode.removeChild(cam.el);
      }
      cam = null;
      clearTimeout(revealTimer);
      clearTimeout(exitTimer);
      if (stopHeadingType) stopHeadingType();
      stopHeadingType = null;
    },
  });
}

function render(container) {
  cam = createAsciiCamera({
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-lg bold pricing-heading' }, '');

  const emailInput = el('input', {
    class: 'input',
    type: 'email',
    placeholder: 'Email',
    autocomplete: 'email',
  });
  const passInput = el('input', {
    class: 'input',
    type: 'password',
    placeholder: 'Password (min 6 chars)',
    autocomplete: 'new-password',
  });
  const nameInput = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'twin name',
    autocomplete: 'name',
  });

  const submitBtn = el('button', { class: 'btn', type: 'button' }, 'Create Account');
  const switchBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Already have an account? Sign in');
  const status = el('p', { class: 'secondary text-sm pricing-status' });

  let isLogin = false;

  function updateMode() {
    if (isLogin) {
      nameInput.style.display = 'none';
      submitBtn.textContent = 'Sign In';
      switchBtn.textContent = "Don't have an account? Sign up";
      passInput.setAttribute('autocomplete', 'current-password');
      passInput.setAttribute('placeholder', 'Password');
    } else {
      nameInput.style.display = '';
      submitBtn.textContent = 'Create Account';
      switchBtn.textContent = 'Already have an account? Sign in';
      passInput.setAttribute('autocomplete', 'new-password');
      passInput.setAttribute('placeholder', 'Password (min 6 chars)');
    }
    status.textContent = '';
  }

  on(switchBtn, 'click', () => {
    isLogin = !isLogin;
    updateMode();
  });

  async function submit() {
    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    const displayName = nameInput.value.trim();

    if (!email) { status.textContent = 'Email is required.'; return; }
    if (!password) { status.textContent = 'Password is required.'; return; }
    if (!isLogin && password.length < 6) { status.textContent = 'Password must be at least 6 characters.'; return; }

    submitBtn.setAttribute('disabled', '');
    status.textContent = isLogin ? 'Signing in...' : 'Creating account...';

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, displayName || 'CyberTwin User');
      }

      status.textContent = 'Success! Redirecting...';
      panel.classList.remove('is-visible');
      panel.classList.add('is-exiting');
      exitTimer = window.setTimeout(() => {
        store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
        // If coming from twin creation flow, continue to pricing
        // Otherwise go straight to dashboard
        if (store.pendingTwinBirth || store.audioBlob || store.characterProfile) {
          navigate('pricing');
        } else {
          navigate('dashboard');
        }
      }, 420);
    } catch (err) {
      status.textContent = err.message;
      submitBtn.removeAttribute('disabled');
    }
  }

  on(submitBtn, 'click', submit);
  on(passInput, 'keydown', (e) => { if (e.key === 'Enter') submit(); });
  on(emailInput, 'keydown', (e) => { if (e.key === 'Enter') passInput.focus(); });

  const formFields = el('div', { class: 'auth-form-fields' },
    emailInput, nameInput, passInput, submitBtn, status, switchBtn);

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-shell pricing-panel' },
    heading,
    formFields,
  );
  const content = el('div', { class: 'recording-content' }, panel);
  const wrapper = el('div', { class: 'screen recording-screen' }, content);

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  container.appendChild(wrapper);
  cam.startBody();
  updateMode();

  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Sign Up', {
      speed: 24,
      swap: false,
    });
  }, 360);
}
