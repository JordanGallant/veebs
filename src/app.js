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
import { store, restorePendingSignup } from './lib/store.js';
import { restoreSession, markOnboardingPaid } from './lib/api.js';
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

async function init() {
  await restoreSession();
  restorePendingSignup();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    const pendingPlan = localStorage.getItem('ct_pending_plan');

    if (pendingPlan && store.user) {
      localStorage.removeItem('ct_pending_plan');
      applyPlanSelection(pendingPlan);
      try {
        await markOnboardingPaid(pendingPlan);
      } catch (err) {
        console.warn('Could not mark onboarding as paid:', err.message);
      }
      store.pendingTwinBirth = true;
      window.location.hash = 'birthing';
    } else if (!store.user && pendingPlan) {
      window.location.hash = 'auth?mode=signin';
    } else if (store.user) {
      window.location.hash = 'dashboard';
    }
  } else if (urlParams.get('payment') === 'cancelled') {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }

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
