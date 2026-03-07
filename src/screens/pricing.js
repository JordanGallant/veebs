import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';

const PRICING_OPTIONS = [
  {
    id: 'trial',
    title: 'Trial',
    price: 'EUR 10 one-time',
    copy: 'Get your twin and 100 text messages to try it out.',
    messages: 100,
    support: false,
    walletBonus: 0,
  },
  {
    id: 'monthly',
    title: 'Monthly',
    price: 'EUR 55,5 / month',
    copy: 'Get 5,555 text messages per month and customer support.',
    messages: 5555,
    support: true,
    walletBonus: 0,
  },
  {
    id: 'yearly',
    title: 'Yearly',
    price: 'EUR 555 / year',
    copy: 'Get 5,555 text messages per month, customer support, and EUR 55 in your twin wallet.',
    messages: 5555,
    support: true,
    walletBonus: 55,
  },
];

let cam = null;
let revealTimer = 0;
let navTimer = 0;
let paymentTimer = 0;
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
      clearTimeout(navTimer);
      clearTimeout(paymentTimer);
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
  const subtitle = el(
    'p',
    { class: 'secondary text-sm' },
    'Choose a plan, then sign up to continue. Your twin is born after payment and sign-up.',
  );

  const optionsWrap = el('div', { class: 'pricing-options' });
  const emailInput = el('input', {
    class: 'input',
    type: 'email',
    placeholder: 'Email',
    autocomplete: 'email',
  });
  const passInput = el('input', {
    class: 'input',
    type: 'password',
    placeholder: 'Password',
    autocomplete: 'new-password',
  });
  const submitBtn = el('button', { class: 'btn', type: 'button', disabled: '' }, 'Select a plan');
  const status = el('p', { class: 'secondary text-sm pricing-status' });

  const signup = el(
    'div',
    { class: 'pricing-signup' },
    emailInput,
    passInput,
    submitBtn,
    status,
  );

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-shell pricing-panel' },
    heading,
    subtitle,
    optionsWrap,
    signup,
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
    submitBtn.textContent = `Sign up and pay (${selectedOption.price})`;
  }

  function applyPlan(option) {
    store.selectedPlan = option.id;
    store.messageQuota = option.messages;
    store.hasCustomerSupport = option.support;

    if (option.walletBonus > 0) {
      store.balance += option.walletBonus;
      store.transactions.push({
        amount: option.walletBonus,
        type: 'bonus',
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    }
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

  on(submitBtn, 'click', () => {
    if (!selectedOption) return;
    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    if (!email || !password) {
      status.textContent = 'Enter email and password to sign up.';
      return;
    }

    status.textContent = 'Processing payment and creating account...';
    submitBtn.setAttribute('disabled', '');
    emailInput.setAttribute('disabled', '');
    passInput.setAttribute('disabled', '');
    paymentTimer = window.setTimeout(() => {
      applyPlan(selectedOption);
      store.pendingTwinBirth = true;
      panel.classList.remove('is-visible');
      panel.classList.add('is-exiting');
      navTimer = window.setTimeout(() => {
        store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
        navigate('birthing');
      }, 420);
    }, 800);
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
