import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store, savePendingSignup } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { getThemeColor } from '../lib/colors.js';
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

const STRIPE_JS_SRC = 'https://js.stripe.com/clover/stripe.js';
const STRIPE_JS_VARIANT = 'clover';
const STRIPE_FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap';
const DEFAULT_THEME_FG = '#2b2927';
const DEFAULT_THEME_BG = '#c6c6f1';

function hexToRgb(hex) {
  const value = hex.replace('#', '').trim();
  if (value.length === 3) {
    return {
      r: Number.parseInt(value[0] + value[0], 16),
      g: Number.parseInt(value[1] + value[1], 16),
      b: Number.parseInt(value[2] + value[2], 16),
    };
  }

  if (value.length === 6) {
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  }

  return null;
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function readThemeToken(name, fallback = '') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function resolveThemeValue(name, property, fallback) {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style[property] = `var(${name})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value || fallback;
}

function buildStripeAppearance() {
  const fg = getThemeColor('--color-fg') || DEFAULT_THEME_FG;
  const bg = getThemeColor('--color-bg') || DEFAULT_THEME_BG;
  const fontFamily = readThemeToken('--font', "'IBM Plex Mono', monospace");
  const borderRadius = readThemeToken('--radius', '4px');
  const spacingUnit = readThemeToken('--space-sm', '8px');
  const fontWeightNormal = readThemeToken('--font-normal', '400');
  const fontWeightBold = readThemeToken('--font-bold', '700');
  const fontSizeBase = resolveThemeValue('--text-body', 'fontSize', '16px');
  const fontSizeSm = resolveThemeValue('--text-sm', 'fontSize', '14px');
  const borderDefault = `1px solid ${withAlpha(fg, 0.2)}`;
  const borderStrong = `1px solid ${withAlpha(fg, 0.3)}`;
  const focusOutline = `2px solid ${fg}`;
  const secondaryText = withAlpha(fg, 0.55);
  const placeholderText = withAlpha(fg, 0.4);
  const pressedSurface = withAlpha(fg, 0.08);

  return {
    theme: 'flat',
    inputs: 'spaced',
    labels: 'above',
    disableAnimations: true,
    variables: {
      colorPrimary: fg,
      colorBackground: bg,
      colorText: fg,
      colorDanger: fg,
      colorSuccess: fg,
      colorWarning: fg,
      colorTextSecondary: secondaryText,
      colorTextPlaceholder: placeholderText,
      accessibleColorOnColorPrimary: bg,
      accessibleColorOnColorBackground: fg,
      buttonColorBackground: fg,
      buttonColorText: bg,
      buttonBorderRadius: borderRadius,
      borderRadius,
      spacingUnit,
      fontFamily,
      fontSizeBase,
      fontSizeSm,
      fontWeightNormal,
      fontWeightMedium: fontWeightBold,
      fontWeightBold,
      fontLineHeight: '1.5',
      iconColor: fg,
      iconHoverColor: fg,
      iconChevronDownColor: fg,
      iconChevronDownHoverColor: fg,
      iconCardErrorColor: fg,
      iconCheckmarkColor: bg,
      tabIconColor: secondaryText,
      tabIconSelectedColor: fg,
      focusOutline,
      focusBoxShadow: 'none',
      logoColor: 'dark',
      tabLogoColor: 'dark',
      tabLogoSelectedColor: 'dark',
      blockLogoColor: 'dark',
    },
    rules: {
      '.Input': {
        backgroundColor: bg,
        border: borderDefault,
        boxShadow: 'none',
        color: fg,
        fontFamily,
        fontSize: fontSizeBase,
        fontWeight: fontWeightNormal,
      },
      '.Input:focus': {
        border: borderStrong,
        boxShadow: 'none',
        outline: focusOutline,
        outlineOffset: '2px',
      },
      '.Input--invalid': {
        border: borderStrong,
        boxShadow: 'none',
        outline: focusOutline,
        outlineOffset: '2px',
      },
      '.Input::placeholder': {
        color: placeholderText,
      },
      '.Label': {
        color: fg,
        fontFamily,
        fontSize: fontSizeSm,
        fontWeight: fontWeightBold,
        opacity: '1',
      },
      '.Label--focused, .Label--invalid': {
        color: fg,
        opacity: '1',
      },
      '.Tab': {
        backgroundColor: bg,
        border: borderDefault,
        boxShadow: 'none',
        color: secondaryText,
        fontFamily,
        fontSize: fontSizeBase,
        fontWeight: fontWeightNormal,
      },
      '.Tab:hover': {
        color: fg,
      },
      '.Tab:focus': {
        outline: focusOutline,
        outlineOffset: '2px',
        boxShadow: 'none',
      },
      '.Tab--selected': {
        backgroundColor: pressedSurface,
        border: borderStrong,
        boxShadow: 'none',
      },
      '.TabLabel': {
        color: secondaryText,
        fontFamily,
      },
      '.TabLabel--selected': {
        color: fg,
        fontWeight: fontWeightBold,
      },
      '.TabIcon': {
        color: secondaryText,
      },
      '.TabIcon--selected': {
        color: fg,
      },
      '.Block': {
        backgroundColor: bg,
        border: borderDefault,
        borderRadius,
        boxShadow: 'none',
      },
      '.AccordionItem': {
        backgroundColor: bg,
        border: borderDefault,
        borderRadius,
        boxShadow: 'none',
      },
      '.AccordionItem:focus-visible': {
        outline: focusOutline,
        outlineOffset: '2px',
        boxShadow: 'none',
      },
      '.AccordionItem--selected': {
        backgroundColor: bg,
        border: borderStrong,
        boxShadow: 'none',
      },
      '.BlockDivider': {
        backgroundColor: withAlpha(fg, 0.1),
      },
      '.Dropdown': {
        backgroundColor: bg,
        border: borderDefault,
        boxShadow: 'none',
        color: fg,
      },
      '.DropdownItem': {
        backgroundColor: bg,
        color: fg,
        fontFamily,
        fontSize: fontSizeBase,
      },
      '.DropdownItem--highlight': {
        backgroundColor: pressedSurface,
        color: fg,
      },
      '.PickerItem': {
        backgroundColor: bg,
        border: borderDefault,
        boxShadow: 'none',
        color: fg,
        fontFamily,
        fontSize: fontSizeBase,
        fontWeight: fontWeightNormal,
      },
      '.PickerItem:hover': {
        border: borderStrong,
        boxShadow: 'none',
        color: fg,
      },
      '.PickerItem:focus': {
        outline: focusOutline,
        outlineOffset: '2px',
        boxShadow: 'none',
      },
      '.PickerItem--selected': {
        backgroundColor: pressedSurface,
        border: borderStrong,
        boxShadow: 'none',
        color: fg,
        fontWeight: fontWeightBold,
      },
      '.CheckboxInput': {
        backgroundColor: bg,
        border: borderStrong,
        boxShadow: 'none',
      },
      '.CheckboxLabel': {
        color: fg,
        fontFamily,
        fontSize: fontSizeSm,
      },
      '.CheckboxInput:focus-visible': {
        outline: focusOutline,
        outlineOffset: '2px',
        boxShadow: 'none',
      },
      '.CodeInput': {
        backgroundColor: bg,
        border: borderDefault,
        boxShadow: 'none',
        color: fg,
        fontFamily,
      },
      '.RadioIcon': {
        width: '18px',
      },
      '.RadioIconOuter': {
        fill: bg,
        fillOpacity: '1',
        stroke: withAlpha(fg, 0.3),
        strokeWidth: '1.5',
      },
      '.RadioIconOuter--checked': {
        stroke: fg,
      },
      '.RadioIconInner': {
        fill: fg,
        r: '12',
      },
      '.Error': {
        color: fg,
        fontFamily,
        fontSize: fontSizeSm,
      },
      '.Text': {
        color: fg,
        fontFamily,
        fontSize: fontSizeBase,
        fontWeight: fontWeightNormal,
      },
      '.RedirectText': {
        color: secondaryText,
        fontFamily,
        fontSize: fontSizeSm,
      },
      '.TermsText': {
        color: secondaryText,
        fontFamily,
        fontSize: fontSizeSm,
      },
      '.TermsLink, .Link, .SecondaryLink': {
        color: fg,
        fontFamily,
        fontWeight: fontWeightBold,
        textDecoration: 'underline',
      },
    },
  };
}

function getCheckoutSubmitLabel(option) {
  if (!option) return 'Confirm payment';
  return option.id === 'monthly' ? `Subscribe ${option.price}` : `Pay ${option.price}`;
}

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
  const actions = el('div', { class: 'pricing-signup' }, submitBtn, status);
  const selectionStage = el('div', { class: 'pricing-stage pricing-selection-stage' }, heading, optionsWrap, actions);
  const checkoutStage = el('div', { class: 'pricing-stage pricing-checkout-shell', hidden: '' });

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-shell pricing-panel' },
    selectionStage,
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
    selectionStage.hidden = isCheckout;
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
    const existingScript = document.querySelector('script[data-stripe-js]');
    if (window.Stripe && existingScript?.dataset.stripeJs === STRIPE_JS_VARIANT) return;

    await new Promise((resolve, reject) => {
      if (existingScript) {
        if (existingScript.dataset.stripeJs !== STRIPE_JS_VARIANT) {
          existingScript.remove();
        } else {
          if (window.Stripe) {
            resolve();
            return;
          }

          existingScript.addEventListener('load', resolve, { once: true });
          existingScript.addEventListener('error', () => reject(new Error('Failed to load Stripe.')), { once: true });
          return;
        }
      }

      const script = document.createElement('script');
      script.src = STRIPE_JS_SRC;
      script.dataset.stripeJs = STRIPE_JS_VARIANT;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Stripe.'));
      document.head.appendChild(script);
    });
  }

  async function mountCustomCheckout(checkout, option) {
    destroyActiveStripeCheckout();

    const backBtn = el('button', { class: 'btn btn--secondary stripe-checkout-back', type: 'button' }, 'Change plan');
    const title = el('p', { class: 'bold pricing-checkout-title' }, option.title);
    const price = el('p', { class: 'pricing-checkout-price' }, option.price);
    const summary = el('div', { class: 'pricing-checkout-summary' }, title, price);
    const header = el('div', { class: 'pricing-checkout-header' }, summary, backBtn);
    const paymentRoot = el('div', { class: 'stripe-payment-element' });
    const loading = el('div', { class: 'stripe-payment-loading secondary text-sm' }, 'Loading secure checkout...');
    const paymentShell = el('div', { class: 'stripe-payment-shell' }, loading, paymentRoot);
    const checkoutStatus = el('p', { class: 'secondary text-sm pricing-checkout-status', 'aria-live': 'polite' });
    const payBtn = el(
      'button',
      { class: 'btn pricing-checkout-submit', type: 'submit', disabled: '' },
      getCheckoutSubmitLabel(option),
    );
    const form = el('form', { class: 'pricing-checkout-form' }, header, paymentShell, payBtn, checkoutStatus);

    on(backBtn, 'click', () => {
      destroyActiveStripeCheckout();
      clearPendingPricingCheckoutSessionId();
      setCheckoutMode(false);
      status.textContent = '';
      updateSubmitState();
    });

    checkoutStage.replaceChildren(form);
    setCheckoutMode(true);

    const stripe = window.Stripe(checkout.publishable_key);
    const checkoutController = await stripe.initCheckout({
      clientSecret: checkout.client_secret,
      elementsOptions: {
        appearance: buildStripeAppearance(),
        fonts: [{ cssSrc: STRIPE_FONT_CSS }],
      },
    });

    const paymentElement = checkoutController.createPaymentElement();
    const checkoutContext = {
      actions: null,
      isConfirming: false,
      destroy() {
        try {
          paymentElement.destroy();
        } catch {
          try {
            paymentElement.unmount();
          } catch {}
        }
      },
    };

    activeStripeCheckout = checkoutContext;

    const readyPromise = new Promise((resolve, reject) => {
      paymentElement.on('ready', resolve);
      paymentElement.on('loaderror', (event) => {
        reject(new Error(event?.error?.message || 'Could not load the payment form.'));
      });
    });

    paymentElement.mount(paymentRoot);

    const loadActionsResultPromise = checkoutController.loadActions().catch((error) => ({
      type: 'error',
      error,
    }));
    await readyPromise;
    loading.remove();

    const loadActionsResult = await loadActionsResultPromise;
    if (loadActionsResult?.type !== 'success') {
      throw new Error(loadActionsResult?.error?.message || 'Could not prepare secure checkout.');
    }

    checkoutContext.actions = loadActionsResult.actions;
    payBtn.removeAttribute('disabled');

    on(form, 'submit', async (event) => {
      event.preventDefault();

      if (!checkoutContext.actions || checkoutContext.isConfirming) return;

      checkoutContext.isConfirming = true;
      payBtn.setAttribute('disabled', '');
      backBtn.setAttribute('disabled', '');
      checkoutStatus.textContent = 'Confirming payment...';

      try {
        const result = await checkoutContext.actions.confirm();
        if (result?.type === 'error' || result?.error) {
          checkoutStatus.textContent = result.error?.message || 'Could not confirm payment. Please try again.';
          checkoutContext.isConfirming = false;
          payBtn.removeAttribute('disabled');
          backBtn.removeAttribute('disabled');
        }
      } catch (err) {
        checkoutStatus.textContent = err.message || 'Could not confirm payment. Please try again.';
        checkoutContext.isConfirming = false;
        payBtn.removeAttribute('disabled');
        backBtn.removeAttribute('disabled');
      }
    });
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
      await mountCustomCheckout(checkout, selectedOption);
      status.textContent = '';
    } catch (err) {
      destroyActiveStripeCheckout();
      setCheckoutMode(false);
      clearPendingPricingCheckoutSessionId();
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
    activeStripeCheckout?.destroy?.();
  } catch {}

  activeStripeCheckout = null;
}
