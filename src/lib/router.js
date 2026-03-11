const routes = new Map();
let currentCleanup;
let container;
let asciiLayer;

export function registerScreen(name, route) {
  routes.set(name, route);
}

export function navigate(screen) {
  window.location.hash = screen;
}

export function getAsciiLayer() {
  return asciiLayer;
}

function getScreenFromHash() {
  const hash = window.location.hash.replace('#', '');
  const [screen] = hash.split('?');
  return routes.has(screen) ? screen : 'welcome';
}

function renderRouteError(error) {
  console.error('Route render failed:', error);
  if (!container) return;

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'screen';

  const panel = document.createElement('div');
  panel.className = 'overlay-panel overlay-shell';

  const heading = document.createElement('h1');
  heading.className = 'text-lg bold';
  heading.textContent = 'Something went wrong';

  const copy = document.createElement('p');
  copy.className = 'secondary text-sm';
  copy.textContent = 'Try again. If this keeps happening, refresh the page.';

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn';
  retryBtn.type = 'button';
  retryBtn.textContent = 'Try again';
  retryBtn.addEventListener('click', () => {
    void render();
  });

  const homeBtn = document.createElement('button');
  homeBtn.className = 'btn btn--secondary';
  homeBtn.type = 'button';
  homeBtn.textContent = 'Go to welcome';
  homeBtn.addEventListener('click', () => {
    window.location.hash = 'welcome';
  });

  panel.append(heading, copy, retryBtn, homeBtn);
  wrapper.appendChild(panel);
  container.appendChild(wrapper);
}

async function render() {
  try {
    if (currentCleanup) {
      try {
        currentCleanup();
      } catch (err) {
        console.warn('Route cleanup failed:', err);
      }
      currentCleanup = undefined;
    }

    const screen = getScreenFromHash();
    const route = routes.get(screen);
    if (!route) return;

    container.innerHTML = '';
    await route.render(container);
    currentCleanup = route.cleanup;
  } catch (error) {
    currentCleanup = undefined;
    renderRouteError(error);
  }
}

export function initRouter(screenEl, asciiEl) {
  container = screenEl;
  asciiLayer = asciiEl;
  window.addEventListener('hashchange', () => {
    void render();
  });
  void render();
}
