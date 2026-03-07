import { initRouter } from './lib/router.js';
import { initFavicon } from './lib/theme.js';
import { registerWelcome } from './screens/welcome.js';
import { registerRecording } from './screens/recording.js';
import { registerQuestions } from './screens/questions.js';
import { registerPricing } from './screens/pricing.js';
import { registerVerifyEmail } from './screens/verify-email.js';
import { registerBirthing } from './screens/birthing.js';
import { registerDashboard } from './screens/dashboard.js';

initFavicon();

registerWelcome();
registerRecording();
registerQuestions();
registerPricing();
registerVerifyEmail();
registerBirthing();
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
