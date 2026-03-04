import { el, on } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { createAudioRecorder } from '../components/audio-recorder.js';

let cam = null;

export function registerRecording() {
  registerScreen('recording', {
    render,
    cleanup() {
      if (cam) cam.stop();
      cam = null;
    },
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function render(container) {
  const stream = store.mediaStream;
  if (!stream) {
    navigate('welcome');
    return;
  }

  cam = createAsciiCamera();
  cam.start(stream);

  const prompt = el(
    'p',
    { class: 'secondary text-sm', style: 'max-width:480px' },
    'Tell your twin about yourself: your hobbies, interests, and what duties you want them to handle for you.',
  );

  const recDot = el('span', { class: 'rec-dot', style: 'display:none' });
  const timerEl = el('span', { class: 'rec-timer' }, '00:00');
  const recBtn = el('button', { class: 'btn' }, 'Start Recording');
  const controls = el('div', { class: 'rec-controls' }, recDot, timerEl, recBtn);
  const errorBox = el('p', { class: 'error', style: 'display:none' });

  const createBtn = el('button', { class: 'btn', style: 'display:none' }, 'Create Twin');

  let recorder = null;
  let timerInterval = 0;
  let elapsed = 0;

  on(recBtn, 'click', async () => {
    if (!recorder || !recorder.isRecording()) {
      errorBox.style.display = 'none';
      recorder = createAudioRecorder(stream);
      try {
        recorder.start();
      } catch {
        recorder = null;
        recDot.style.display = 'none';
        recBtn.textContent = 'Start Recording';
        createBtn.style.display = 'none';
        clearInterval(timerInterval);
        timerEl.textContent = '00:00';
        errorBox.style.display = '';
        errorBox.textContent =
          'Recording could not start in this browser/device setup. Try refreshing, allowing microphone access, and closing other apps that might use the mic.';
        return;
      }

      cam.snapshot().then((blob) => {
        store.photoBlob = blob;
      });

      elapsed = 0;
      timerEl.textContent = '00:00';
      recDot.style.display = '';
      recBtn.textContent = 'Stop Recording';
      createBtn.style.display = 'none';

      timerInterval = window.setInterval(() => {
        elapsed++;
        timerEl.textContent = formatTime(elapsed);
      }, 1000);
    } else {
      const audioBlob = await recorder.stop();
      store.audioBlob = audioBlob;

      clearInterval(timerInterval);
      recDot.style.display = 'none';
      recBtn.textContent = 'Re-record';
      createBtn.style.display = '';
    }
  });

  on(createBtn, 'click', () => {
    if (cam) cam.stop();
    cam = null;
    navigate('birthing');
  });

  const wrapper = el(
    'div',
    { class: 'screen' },
    cam.el,
    prompt,
    controls,
    errorBox,
    createBtn,
  );

  container.appendChild(wrapper);
}
