import { initRouter } from './lib/router.js';
import { initFavicon } from './lib/favicon.js';
import { registerWelcome } from './screens/welcome.js';
import { registerRecording } from './screens/recording.js';
import { registerQuestions } from './screens/questions.js';
import { registerPricing } from './screens/pricing.js';
import { registerVerifyEmail } from './screens/verify-email.js';
import { registerBirthing } from './screens/birthing.js';
import { registerDashboard } from './screens/dashboard.js';
import { registerAuth } from './screens/auth.js';
import { registerShare } from './screens/share.js';
import {
  store,
  resetSession,
  restorePendingSignup,
  savePendingSignup,
} from './lib/store.js';
import {
  clearPendingPricingCheckoutSessionId,
  getPricingCheckoutSession,
  isCompletedPricingCheckoutSession,
  isEmailVerified,
  markOnboardingPaid,
  restoreSession,
} from './lib/api.js';
import { applyPlanSelection } from './lib/plans.js';

initFavicon();

registerWelcome();
registerRecording();
registerQuestions();
registerPricing();
registerVerifyEmail();
registerBirthing();
registerAuth();
registerDashboard();
registerShare();

function syncSharePathToHash() {
  const match = window.location.pathname.match(/^\/share\/([^/]+)$/);
  if (!match?.[1]) return;

  const token = decodeURIComponent(match[1]);
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.hash = `share?token=${encodeURIComponent(token)}`;
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function clearPaymentSearchParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete('payment');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

async function init() {
  restorePendingSignup();
  try {
    await restoreSession();
  } catch (err) {
    console.warn('Could not restore auth session:', err.message);
    resetSession({ preservePendingSignup: true });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const returnedSessionId = urlParams.get('session_id');
  if (returnedSessionId) {
    localStorage.setItem('ct_pending_checkout_session_id', returnedSessionId);
  }

  if (paymentStatus === 'success') {
    const pendingPlan = localStorage.getItem('ct_pending_plan');
    let verifiedPlan = pendingPlan;
    let verifiedPricingCheckout = !pendingPlan;

    if (pendingPlan && returnedSessionId) {
      try {
        const checkoutSession = await getPricingCheckoutSession(returnedSessionId);
        verifiedPricingCheckout = isCompletedPricingCheckoutSession(checkoutSession);
        verifiedPlan = checkoutSession.plan_id || pendingPlan;
      } catch (err) {
        verifiedPricingCheckout = false;
        console.warn('Could not verify Stripe checkout session:', err.message);
      }
    } else if (pendingPlan) {
      verifiedPricingCheckout = false;
    }

    clearPaymentSearchParams();

    if (pendingPlan && verifiedPricingCheckout && store.user && isEmailVerified(store.user)) {
      localStorage.removeItem('ct_pending_plan');
      clearPendingPricingCheckoutSessionId();
      applyPlanSelection(verifiedPlan);
      try {
        await markOnboardingPaid(verifiedPlan);
      } catch (err) {
        console.warn('Could not mark onboarding as paid:', err.message);
      }
      store.pendingTwinBirth = true;
      window.location.hash = 'birthing';
    } else if (pendingPlan && store.user && !isEmailVerified(store.user)) {
      savePendingSignup(
        store.user.email || store.pendingSignupEmail,
        store.pendingSignupName || store.name || store.user.user_metadata?.display_name || 'My Twin',
      );
      window.location.hash = 'verify-email';
    } else if (pendingPlan && !store.user) {
      window.location.hash = 'auth?mode=signin';
    } else if (pendingPlan && !verifiedPricingCheckout) {
      clearPendingPricingCheckoutSessionId();
      window.location.hash = 'pricing';
    } else if (store.user) {
      clearPendingPricingCheckoutSessionId();
      window.location.hash = 'dashboard';
    }
  } else if (paymentStatus === 'cancelled') {
    clearPendingPricingCheckoutSessionId();
    clearPaymentSearchParams();
  }

  syncSharePathToHash();

  const app = document.getElementById('app');
  if (app) {
    const asciiLayer = document.createElement('div');
    asciiLayer.id = 'ascii-layer';
    const screenContainer = document.createElement('div');
    screenContainer.id = 'screen-container';
    app.appendChild(asciiLayer);
    app.appendChild(screenContainer);
    initRouter(screenContainer, asciiLayer);
  }
}

init().catch((err) => {
  console.error('App init failed:', err);
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'overlay-panel overlay-shell';

  const heading = document.createElement('h1');
  heading.className = 'text-lg bold';
  heading.textContent = 'Could not start the app';

  const copy = document.createElement('p');
  copy.className = 'secondary text-sm';
  copy.textContent = 'Please refresh and try again.';

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn';
  retryBtn.type = 'button';
  retryBtn.textContent = 'Refresh';
  retryBtn.addEventListener('click', () => {
    window.location.reload();
  });

  panel.append(heading, copy, retryBtn);
  app.appendChild(panel);
});
