import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';
import { createCheckout, markOnboardingPaid, syncOnboardingData } from '../lib/api.js';
import { PLAN_OPTIONS, applyPlanSelection } from '../lib/plans.js';

let cam = null;
let revealTimer = 0;
let stopHeadingType = null;

export function registerPricing() {
  registerScreen('pricing', {
    render,
    cleanup() {
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
  // If not logged in, redirect to auth first
  if (!store.user) {
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
    'Choose a plan to activate your twin.',
  );

  const optionsWrap = el('div', { class: 'pricing-options' });
  const submitBtn = el('button', { class: 'btn', type: 'button', disabled: '' }, 'Select a plan');
  const skipBtn = el('button', { class: 'btn btn--secondary', type: 'button', disabled: '' }, 'Skip for now');
  const status = el('p', { class: 'secondary text-sm pricing-status' });

  const actions = el('div', { class: 'pricing-signup' }, submitBtn, skipBtn, status);

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-shell pricing-panel' },
    heading,
    subtitle,
    optionsWrap,
    actions,
  );
  const content = el('div', { class: 'recording-content' }, panel);
  const wrapper = el('div', { class: 'screen recording-screen' }, content);

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  let selectedOption = null;
  let onboardingReady = false;

  function updateSubmitState() {
    if (!onboardingReady || !selectedOption) {
      submitBtn.setAttribute('disabled', '');
      submitBtn.textContent = 'Select a plan';
      return;
    }
    submitBtn.removeAttribute('disabled');
    submitBtn.textContent = `Pay (${selectedOption.price})`;
  }

  function renderOptions() {
    optionsWrap.innerHTML = '';
    for (const option of PLAN_OPTIONS) {
      const btn = el(
        'button',
        {
          class: selectedOption && selectedOption.id === option.id ? 'pricing-option pricing-option--selected' : 'pricing-option',
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

  on(skipBtn, 'click', () => {
    if (!onboardingReady) return;
    applyPlanSelection('skip');
    store.pendingTwinBirth = true;
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    setTimeout(() => {
      store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
      navigate('birthing');
    }, 420);
  });

  function proceedToBirthing() {
    store.pendingTwinBirth = true;
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    // Also hide checkout embed if visible
    const embedEl = wrapper.querySelector('.stripe-embed');
    if (embedEl) embedEl.style.display = 'none';
    setTimeout(() => {
      store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
      navigate('birthing');
    }, 420);
  }

  async function finalizePaidPlan(planId) {
    applyPlanSelection(planId);
    await markOnboardingPaid(planId);
    proceedToBirthing();
  }

  on(submitBtn, 'click', async () => {
    if (!selectedOption || !onboardingReady) return;

    submitBtn.setAttribute('disabled', '');
    skipBtn.setAttribute('disabled', '');
    status.textContent = 'Loading payment...';

    try {
      const checkout = await createCheckout(selectedOption.amountUsd, { embedded: true });
      if (checkout.client_secret && checkout.publishable_key) {
        // Load Stripe.js if not already loaded
        if (!window.Stripe) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://js.stripe.com/v3/';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load Stripe'));
            document.head.appendChild(s);
          });
        }

        // Hide the pricing panel, show embedded checkout
        panel.style.display = 'none';

        const checkoutDiv = el('div', { class: 'stripe-embed' });
        const backBtn = el('button', { class: 'btn btn--secondary stripe-embed-back', type: 'button' }, '← Back');
        const embedWrap = el('div', { class: 'stripe-embed-wrap' }, backBtn, checkoutDiv);
        content.appendChild(embedWrap);

        on(backBtn, 'click', () => {
          embedWrap.remove();
          panel.style.display = '';
          submitBtn.removeAttribute('disabled');
          skipBtn.removeAttribute('disabled');
          status.textContent = '';
        });

        const stripe = window.Stripe(checkout.publishable_key);
        const stripeCheckout = await stripe.initEmbeddedCheckout({
          clientSecret: checkout.client_secret,
        });
        stripeCheckout.mount(checkoutDiv);

        // Poll for completion (Stripe embedded fires return_url but we intercept)
        // TODO: poll checkout status via Supabase Edge Function
        const pollInterval = setInterval(async () => {
          try {
            // Placeholder — wire up status check when Stripe backend is ready
          } catch {}
        }, 2000);
      } else if (checkout.checkout_url) {
        // Fallback to redirect if embedded not available
        localStorage.setItem('ct_pending_plan', selectedOption.id);
        window.location.href = checkout.checkout_url;
      } else {
        await finalizePaidPlan(selectedOption.id);
      }
    } catch (err) {
      status.textContent = err.message;
      submitBtn.removeAttribute('disabled');
      skipBtn.removeAttribute('disabled');
    }
  });

  container.appendChild(wrapper);
  cam.startBody();
  renderOptions();
  updateSubmitState();
  preparePricing();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Choose your plan', {
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
      skipBtn.removeAttribute('disabled');
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
