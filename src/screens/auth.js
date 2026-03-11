import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import {
  store,
  clearOnboardingDraft,
  clearPendingSignup,
  savePendingSignup,
  DEFAULT_TWIN_NAME,
} from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';
import {
  register,
  login,
  loadOrCreateAgent,
  restoreSession,
  syncOnboardingData,
  markOnboardingPaid,
} from '../lib/api.js';
import { applyPlanSelection } from '../lib/plans.js';

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
  const authHash = window.location.hash.replace('#', '');
  const authParams = new URLSearchParams(authHash.split('?')[1] || '');
  let isLogin = authParams.get('mode') === 'signin';

  if (!isLogin && !store.hasAnsweredQuestions && !store.user) {
    navigate('welcome');
    return;
  }

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
  emailInput.value = store.pendingSignupEmail || '';
  nameInput.value = store.pendingSignupName || '';

  function updateMode() {
    if (isLogin) {
      nameInput.style.display = 'none';
      submitBtn.textContent = 'Sign In';
      switchBtn.textContent = "Don't have a twin? Create one";
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
    syncHeading();
  }

  on(switchBtn, 'click', () => {
    if (isLogin) {
      navigate('welcome');
      return;
    }
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
      let needsEmailConfirmation = false;
      if (isLogin) {
        await login(email, password);
        clearPendingSignup();
        status.textContent = 'Loading your twin...';
        await restoreSession();

        if (store.agentId) {
          clearOnboardingDraft();
          localStorage.removeItem('ct_pending_plan');
          status.textContent = 'Welcome back. Redirecting...';
          panel.classList.remove('is-visible');
          panel.classList.add('is-exiting');
          exitTimer = window.setTimeout(() => {
            store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
            navigate('dashboard');
          }, 420);
          return;
        }

        status.textContent = 'Syncing your onboarding...';
        if (hasOnboardingData()) {
          await syncOnboardingData();
        }
      } else {
        const signUp = await register(email, password, displayName || 'CyberTwin User');
        needsEmailConfirmation = Boolean(signUp?.needsEmailConfirmation);
        if (!needsEmailConfirmation) {
          throw new Error('Enable email confirmation in Supabase Auth and send the signup template as a code.');
        }

        const twinName = displayName || store.pendingSignupName || 'My Twin';
        store.name = twinName;
        savePendingSignup(email, twinName);
        status.textContent = 'We sent an 8-digit code to your email.';
        panel.classList.remove('is-visible');
        panel.classList.add('is-exiting');
        exitTimer = window.setTimeout(() => {
          store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
          navigate('verify-email');
        }, 420);
        return;
      }

      status.textContent = 'Setting up your twin...';
      const existingStoreName = store.name !== DEFAULT_TWIN_NAME ? store.name : '';
      const agentName = store.pendingSignupName || displayName || existingStoreName || 'My Twin';
      const agent = await loadOrCreateAgent(agentName, store.characterProfile);
      store.name = agent?.name || agentName;

      const pendingPaidPlan = localStorage.getItem('ct_pending_plan');
      if (pendingPaidPlan) {
        localStorage.removeItem('ct_pending_plan');
        applyPlanSelection(pendingPaidPlan);
        await markOnboardingPaid(pendingPaidPlan);
        store.pendingTwinBirth = true;
      }

      status.textContent = 'Success! Redirecting...';
      panel.classList.remove('is-visible');
      panel.classList.add('is-exiting');
      exitTimer = window.setTimeout(() => {
        store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
        if (store.pendingTwinBirth) {
          navigate('birthing');
        } else if (shouldContinueOnboarding()) {
          navigate('pricing');
        } else {
          navigate('dashboard');
        }
      }, 420);
    } catch (err) {
      submitBtn.removeAttribute('disabled');
      if (!isLogin && err.message.toLowerCase().includes('already')) {
        isLogin = true;
        updateMode();
        status.textContent = 'Account already exists — sign in instead.';
      } else {
        status.textContent = err.message;
      }
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
    syncHeading();
  }, 360);

  function syncHeading() {
    if (!panel.classList.contains('is-visible')) return;
    if (stopHeadingType) stopHeadingType();
    stopHeadingType = animateTypewriter(heading, isLogin ? 'Sign In' : 'Set up your twin', {
      speed: 24,
      swap: false,
    });
  }
}

function hasOnboardingData() {
  return Boolean(
    store.hasAnsweredQuestions ||
    store.onboardingAnswers ||
    store.photoBlob ||
    store.audioBlob,
  );
}

function shouldContinueOnboarding() {
  return Boolean(
    store.pendingTwinBirth ||
    store.selectedPlan ||
    hasOnboardingData(),
  );
}
