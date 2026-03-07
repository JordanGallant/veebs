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
import { store } from './lib/store.js';
import { restoreSession } from './lib/api.js';

initFavicon();

// Always restore session from localStorage on page load
restoreSession();

// Handle Stripe payment return
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('payment') === 'success') {
  // Clean up URL
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  // Restore session and go to birthing/dashboard
  if (restoreSession()) {
    const pendingPlan = localStorage.getItem('ct_pending_plan');
    if (pendingPlan) {
      localStorage.removeItem('ct_pending_plan');
      store.selectedPlan = pendingPlan;
      store.pendingTwinBirth = true;
      window.location.hash = 'birthing';
    } else {
      window.location.hash = 'dashboard';
    }
  }
} else if (urlParams.get('payment') === 'cancelled') {
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);
}

registerWelcome();
registerRecording();
registerQuestions();
registerPricing();
registerVerifyEmail();
registerBirthing();
registerAuth();
registerDashboard();

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
