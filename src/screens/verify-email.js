import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store, clearPendingSignup, restorePendingSignup, savePendingSignup } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';
import {
  isEmailVerified,
  verifySignupCode,
  resendSignupCode,
  loadOrCreateAgent,
  syncOnboardingData,
} from '../lib/api.js';

const EMAIL_CODE_LENGTH = 8;

let cam = null;
let revealTimer = 0;
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
      clearTimeout(navTimer);
      if (stopHeadingType) stopHeadingType();
      stopHeadingType = null;
    },
  });
}

function render(container) {
  restorePendingSignup();

  if (!store.pendingSignupEmail && store.user?.email && !isEmailVerified(store.user)) {
    savePendingSignup(
      store.user.email,
      store.pendingSignupName || store.name || store.user.user_metadata?.display_name || 'My Twin',
    );
  }

  if (!store.pendingSignupEmail) {
    navigate('auth');
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
    `Enter the 8-digit code sent to ${store.pendingSignupEmail}.`,
  );

  const codeInput = el('input', {
    class: 'input verify-code',
    type: 'text',
    inputmode: 'numeric',
    maxlength: String(EMAIL_CODE_LENGTH),
    placeholder: '00000000',
    autocomplete: 'one-time-code',
  });
  const confirmBtn = el('button', { class: 'btn', type: 'button', disabled: '' }, 'Confirm email');
  const resendBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Resend code');
  const status = el('p', { class: 'secondary text-sm pricing-status' });

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-shell verify-panel' },
    heading,
    subtitle,
    codeInput,
    confirmBtn,
    resendBtn,
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
    const sanitized = codeInput.value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH);
    codeInput.value = sanitized;
    if (sanitized.length === EMAIL_CODE_LENGTH) {
      confirmBtn.removeAttribute('disabled');
      status.textContent = '';
    } else {
      confirmBtn.setAttribute('disabled', '');
    }
  });

  on(confirmBtn, 'click', async () => {
    if (codeInput.value.length !== EMAIL_CODE_LENGTH) return;
    confirmBtn.setAttribute('disabled', '');
    resendBtn.setAttribute('disabled', '');
    codeInput.setAttribute('disabled', '');
    status.textContent = 'Confirming email...';

    try {
      await verifySignupCode(store.pendingSignupEmail, codeInput.value);

      status.textContent = 'Saving your onboarding...';
      const agentName = store.pendingSignupName || store.name || 'My Twin';
      const agent = await loadOrCreateAgent(agentName, store.characterProfile);
      store.name = agent?.name || agentName;
      await syncOnboardingData();
      clearPendingSignup();

      panel.classList.remove('is-visible');
      panel.classList.add('is-exiting');
      navTimer = window.setTimeout(() => {
        store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
        navigate('pricing');
      }, 420);
    } catch (err) {
      confirmBtn.removeAttribute('disabled');
      resendBtn.removeAttribute('disabled');
      codeInput.removeAttribute('disabled');
      status.textContent = err.message;
    }
  });

  on(resendBtn, 'click', async () => {
    resendBtn.setAttribute('disabled', '');
    status.textContent = 'Sending a new code...';

    try {
      await resendSignupCode(store.pendingSignupEmail);
      status.textContent = 'A new code is on the way.';
    } catch (err) {
      status.textContent = err.message;
    } finally {
      resendBtn.removeAttribute('disabled');
    }
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
