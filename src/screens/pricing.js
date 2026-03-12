import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store, savePendingSignup } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';
import {
  clearPendingPricingCheckoutSessionId,
  createPricingCheckoutSession,
  getActiveSessionUser,
  isEmailVerified,
  syncOnboardingData,
} from '../lib/api.js';
import { PLAN_OPTIONS } from '../lib/plans.js';

let cam = null;
let revealTimer = 0;
let stopHeadingType = null;
let activeStripeCheckout = null;

export function registerPricing() {
  registerScreen('pricing', {
    render,
    cleanup() {
      destroyActiveStripeCheckout();
      if (cam) {
        cam.stop();
        if (cam.el.parentNode) cam.el.parentNode.removeChild(cam.el);
      }
      cam = null;
      clearTimeout(revealTimer);
      if (stopHeadingType) stopHeadingType();
      stopHeadingType = null;
    },
  });
}

async function render(container) {
  const sessionUser = await getActiveSessionUser();
  if (!sessionUser) {
    navigate('auth');
    return;
  }
  if (!isEmailVerified(sessionUser)) {
    savePendingSignup(
      sessionUser.email || store.pendingSignupEmail,
      store.pendingSignupName || store.name || sessionUser.user_metadata?.display_name || 'My Twin',
    );
    navigate('verify-email');
    return;
  }

  cam = createAsciiCamera({
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-lg bold pricing-heading' }, '');

  const optionsWrap = el('div', { class: 'pricing-options' });
  const submitBtn = el('button', { class: 'btn', type: 'button', disabled: '' }, 'Continue with Stripe');
  const status = el('p', { class: 'secondary text-sm pricing-status' });
  const checkoutStage = el('div', { class: 'pricing-checkout-shell', hidden: '' });

  const actions = el('div', { class: 'pricing-signup' }, submitBtn, status);

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-shell pricing-panel' },
    heading,
    optionsWrap,
    actions,
    checkoutStage,
  );
  const content = el('div', { class: 'recording-content' }, panel);
  const wrapper = el('div', { class: 'screen recording-screen' }, content);

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  let selectedOption = PLAN_OPTIONS.find((option) => option.recommended) || PLAN_OPTIONS[0] || null;
  let onboardingReady = false;

  function updateSubmitState() {
    if (!onboardingReady || !selectedOption) {
      submitBtn.setAttribute('disabled', '');
      submitBtn.textContent = 'Choose a plan';
      return;
    }
    submitBtn.removeAttribute('disabled');
    submitBtn.textContent = 'Continue with Stripe';
  }

  function renderOptions() {
    optionsWrap.innerHTML = '';
    for (const option of PLAN_OPTIONS) {
      const btn = el(
        'button',
        {
          class: selectedOption && selectedOption.id === option.id ? 'pricing-option pricing-option--selected' : 'pricing-option',
          'aria-pressed': selectedOption && selectedOption.id === option.id ? 'true' : 'false',
          type: 'button',
        },
        el(
          'div',
          { class: 'pricing-option-row' },
          el('span', { class: 'bold' }, option.title),
          el('span', { class: 'pricing-option-price' }, option.price),
        ),
        el('p', { class: 'secondary text-sm pricing-option-copy' }, option.copy),
      );
      on(btn, 'click', () => {
        selectedOption = option;
        renderOptions();
        updateSubmitState();
      });
      optionsWrap.appendChild(btn);
    }
  }

  function setCheckoutMode(isCheckout) {
    panel.classList.toggle('pricing-panel--checkout', isCheckout);
    optionsWrap.hidden = isCheckout;
    actions.hidden = isCheckout;
    checkoutStage.hidden = !isCheckout;
    if (isCheckout) {
      checkoutStage.classList.remove('print-reveal');
      void checkoutStage.offsetWidth;
      checkoutStage.classList.add('print-reveal');
    } else {
      checkoutStage.classList.remove('print-reveal');
    }
  }

  async function ensureStripeJs() {
    if (window.Stripe) return;
    await new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-stripe-js]');
      if (existingScript) {
        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Stripe.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.dataset.stripeJs = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Stripe.'));
      document.head.appendChild(script);
    });
  }

  async function mountEmbeddedCheckout(checkout, option) {
    destroyActiveStripeCheckout();

    const checkoutDiv = el('div', { class: 'stripe-embed' });
    const loading = el('div', { class: 'stripe-embed-loading secondary text-sm' }, 'Loading secure checkout...');
    const backBtn = el('button', { class: 'btn btn--secondary stripe-embed-back', type: 'button' }, 'Change plan');

    on(backBtn, 'click', () => {
      destroyActiveStripeCheckout();
      clearPendingPricingCheckoutSessionId();
      setCheckoutMode(false);
      status.textContent = '';
      updateSubmitState();
    });

    checkoutStage.replaceChildren(
      el(
        'div',
        { class: 'pricing-checkout-summary' },
        el(
          'div',
          { class: 'pricing-checkout-heading' },
          el(
            'h2',
            { class: 'bold pricing-checkout-title' },
            option.title,
          ),
          el('p', { class: 'secondary text-sm pricing-checkout-copy' }, option.copy),
        ),
        el('p', { class: 'pricing-checkout-price' }, option.price),
      ),
      backBtn,
      el('div', { class: 'stripe-embed-wrap' }, loading, checkoutDiv),
    );

    setCheckoutMode(true);

    const stripe = window.Stripe(checkout.publishable_key);
    activeStripeCheckout = await stripe.initEmbeddedCheckout({
      clientSecret: checkout.client_secret,
    });
    activeStripeCheckout.mount(checkoutDiv);
    loading.remove();
  }

  on(submitBtn, 'click', async () => {
    if (!selectedOption || !onboardingReady) return;

    submitBtn.setAttribute('disabled', '');
    status.textContent = 'Preparing secure checkout...';
    localStorage.setItem('ct_pending_plan', selectedOption.id);
    clearPendingPricingCheckoutSessionId();

    try {
      const checkout = await createPricingCheckoutSession(selectedOption.id);
      await ensureStripeJs();
      await mountEmbeddedCheckout(checkout, selectedOption);
      status.textContent = '';
    } catch (err) {
      destroyActiveStripeCheckout();
      setCheckoutMode(false);
      status.textContent = err.message;
      submitBtn.removeAttribute('disabled');
    }
  });

  container.appendChild(wrapper);
  cam.startBody();
  renderOptions();
  updateSubmitState();
  preparePricing();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Get your twin', {
      speed: 24,
      swap: false,
    });
  }, 360);

  async function preparePricing() {
    status.textContent = 'Syncing your onboarding...';

    try {
      if (hasOnboardingPayload()) {
        await syncOnboardingData();
      }
      onboardingReady = true;
      status.textContent = '';
      updateSubmitState();
    } catch (err) {
      status.textContent = err.message;
    }
  }
}

function hasOnboardingPayload() {
  return Boolean(
    store.hasAnsweredQuestions ||
    store.onboardingAnswers ||
    store.photoBlob ||
    store.audioBlob,
  );
}

function destroyActiveStripeCheckout() {
  try {
    if (activeStripeCheckout?.destroy) {
      activeStripeCheckout.destroy();
    } else if (activeStripeCheckout?.unmount) {
      activeStripeCheckout.unmount();
    }
  } catch {}

  activeStripeCheckout = null;
}
