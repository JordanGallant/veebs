import { initRouter } from './lib/router.js';
import { initFavicon } from './lib/theme.js';
import { registerWelcome } from './screens/welcome.js';
import { registerRecording } from './screens/recording.js';
import { registerBirthing } from './screens/birthing.js';
import { registerDashboard } from './screens/dashboard.js';

initFavicon();

registerWelcome();
registerRecording();
registerBirthing();
registerDashboard();

const app = document.getElementById('app');
if (app) {
  initRouter(app);
}
