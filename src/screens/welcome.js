import { el, on } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';

let cam = null;

export function registerWelcome() {
  registerScreen('welcome', {
    render,
    cleanup() {
      if (cam) cam.stop();
      cam = null;
    },
  });
}

function render(container) {
  cam = createAsciiCamera();

  const heading = el('h1', { class: 'text-xl bold' }, 'Extract Your DNA');

  const subtitle = el(
    'p',
    { class: 'secondary', style: 'max-width:480px' },
    'CyberTwin needs access to your camera and microphone to capture your appearance and voice. This data creates the foundation for your digital twin.',
  );

  const errorBox = el('p', { class: 'error', style: 'display:none' });

  const btn = el('button', { class: 'btn' }, 'Allow Access');

  on(btn, 'click', async () => {
    btn.setAttribute('disabled', '');
    btn.textContent = 'Requesting access...';
    errorBox.style.display = 'none';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      store.mediaStream = stream;
      navigate('recording');
    } catch {
      btn.removeAttribute('disabled');
      btn.textContent = 'Allow Access';
      errorBox.style.display = '';
      errorBox.textContent =
        'Permission denied. Please allow camera and microphone access in your browser settings and try again.';
    }
  });

  const content = el('div', { class: 'welcome-content' }, heading, subtitle, errorBox, btn);

  const wrapper = el(
    'div',
    { class: 'screen welcome-screen' },
    cam.el,
    content,
  );

  container.appendChild(wrapper);
  cam.startBody();
}
