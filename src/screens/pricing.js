import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';
import { createCheckout } from '../lib/api.js';

const PRICING_OPTIONS = [
  {
    id: 'trial',
    title: 'Trial',
    price: 'EUR 10 one-time',
    copy: 'Get your twin and 100 text messages to try it out.',
    messages: 100,
    support: false,
    walletBonus: 0,
    amountUsd: 10,
  },
  {
    id: 'monthly',
    title: 'Monthly',
    price: 'EUR 55,5 / month',
    copy: 'Get 5,555 text messages per month and customer support.',
    messages: 5555,
    support: true,
    walletBonus: 0,
    amountUsd: 55.5,
  },
  {
    id: 'yearly',
    title: 'Yearly',
    price: 'EUR 555 / year',
    copy: 'Get 5,555 text messages per month, customer support, and EUR 55 in your twin wallet.',
    messages: 5555,
    support: true,
    walletBonus: 55,
    amountUsd: 555,
  },
];

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

function render(container) {
  // If not logged in, redirect to auth first
  if (!store.token) {
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
  const skipBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Skip for now');
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

  function updateSubmitState() {
    if (!selectedOption) {
      submitBtn.setAttribute('disabled', '');
      submitBtn.textContent = 'Select a plan';
      return;
    }
    submitBtn.removeAttribute('disabled');
    submitBtn.textContent = `Pay (${selectedOption.price})`;
  }

  function renderOptions() {
    optionsWrap.innerHTML = '';
    for (const option of PRICING_OPTIONS) {
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
    store.pendingTwinBirth = true;
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    setTimeout(() => {
      store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
      navigate('birthing');
    }, 420);
  });

  on(submitBtn, 'click', async () => {
    if (!selectedOption) return;

    submitBtn.setAttribute('disabled', '');
    status.textContent = 'Redirecting to payment...';

    // Store plan info
    store.selectedPlan = selectedOption.id;
    store.messageQuota = selectedOption.messages;
    store.hasCustomerSupport = selectedOption.support;

    if (selectedOption.walletBonus > 0) {
      store.balance += selectedOption.walletBonus;
      store.transactions.push({
        amount: selectedOption.walletBonus,
        type: 'bonus',
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    }

    try {
      const checkout = await createCheckout(selectedOption.amountUsd);
      if (checkout.checkout_url) {
        localStorage.setItem('ct_pending_plan', selectedOption.id);
        window.location.href = checkout.checkout_url;
      } else {
        // Stripe not configured — skip payment
        store.pendingTwinBirth = true;
        panel.classList.remove('is-visible');
        panel.classList.add('is-exiting');
        setTimeout(() => {
          store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
          navigate('birthing');
        }, 420);
      }
    } catch (err) {
      status.textContent = err.message;
      submitBtn.removeAttribute('disabled');
    }
  });

  container.appendChild(wrapper);
  cam.startBody();
  renderOptions();
  updateSubmitState();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    stopHeadingType = animateTypewriter(heading, 'Choose your plan', {
      speed: 24,
      swap: false,
    });
  }, 360);
}
