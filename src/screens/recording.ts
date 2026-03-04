import { el, on } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera, type AsciiCamera } from '../components/ascii-camera.js';
import { createAudioRecorder, type AudioRecorder } from '../components/audio-recorder.js';

let cam: AsciiCamera | null = null;

export function registerRecording(): void {
  registerScreen('recording', {
    render,
    cleanup() {
      cam?.stop();
      cam = null;
    },
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function render(container: HTMLElement): void {
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

  const createBtn = el('button', { class: 'btn', style: 'display:none' }, 'Create Twin');

  let recorder: AudioRecorder | null = null;
  let timerInterval = 0;
  let elapsed = 0;

  on(recBtn, 'click', async () => {
    if (!recorder || !recorder.isRecording()) {
      recorder = createAudioRecorder(stream);
      recorder.start();

      cam!.snapshot().then((blob) => {
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
    cam?.stop();
    cam = null;
    navigate('birthing');
  });

  const wrapper = el(
    'div',
    { class: 'screen' },
    cam.el,
    prompt,
    controls,
    createBtn,
  );

  container.appendChild(wrapper);
}
