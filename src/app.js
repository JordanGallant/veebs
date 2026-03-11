import { initRouter } from './lib/router.js';
import { initFavicon } from './lib/theme.js';
import { registerWelcome } from './screens/welcome.js';
import { registerRecording } from './screens/recording.js';
import { registerQuestions } from './screens/questions.js';
import { registerPricing } from './screens/pricing.js';
import { registerVerifyEmail } from './screens/verify-email.js';
import { registerBirthing } from './screens/birthing.js';
import { registerDashboard } from './screens/dashboard.js';
import { registerAuth } from './screens/auth.js';
import { registerShare } from './screens/share.js';
import { store, restorePendingSignup, savePendingSignup } from './lib/store.js';
import { restoreSession, isEmailVerified, markOnboardingPaid } from './lib/api.js';
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

async function init() {
  await restoreSession();
  restorePendingSignup();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    const pendingPlan = localStorage.getItem('ct_pending_plan');

    if (pendingPlan && store.user && isEmailVerified(store.user)) {
      localStorage.removeItem('ct_pending_plan');
      applyPlanSelection(pendingPlan);
      try {
        await markOnboardingPaid(pendingPlan);
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
    } else if (!store.user && pendingPlan) {
      window.location.hash = 'auth?mode=signin';
    } else if (store.user) {
      window.location.hash = 'dashboard';
    }
  } else if (urlParams.get('payment') === 'cancelled') {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
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

init();
