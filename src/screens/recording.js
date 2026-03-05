import { el, on } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { createAudioRecorder } from '../components/audio-recorder.js';

const BIRTHING_MESSAGES = [
  'Analyzing voice patterns...',
  'Mapping facial features...',
  'Generating personality matrix...',
  'Initializing neural pathways...',
  'Calibrating empathy circuits...',
  'Bootstrapping consciousness...',
];

let cam = null;
let birthingMsgTimer = 0;
let birthingNavTimer = 0;

export function registerRecording() {
  registerScreen('recording', {
    render,
    cleanup() {
      if (cam) cam.stop();
      cam = null;
      clearInterval(birthingMsgTimer);
      clearTimeout(birthingNavTimer);
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

  cam = createAsciiCamera({ mirror: true, rain: true });

  const prompt = el(
    'p',
    { class: 'secondary text-sm', style: 'max-width:480px' },
    'Tell your twin about yourself: your hobbies, interests, and what duties you want your twin to handle for you.',
  );

  const recDot = el('span', { class: 'rec-dot', style: 'display:none' });
  const timerEl = el('span', { class: 'rec-timer' }, '00:00');
  const recBtn = el('button', { class: 'btn' }, 'Start Recording');
  const controls = el('div', { class: 'rec-controls' }, recDot, timerEl, recBtn);
  const errorBox = el('p', { class: 'error', style: 'display:none' });
  const createBtn = el('button', { class: 'btn', style: 'display:none' }, 'Create Twin');

  const recordingPanel = el('div', { class: 'overlay-panel' }, prompt, controls, errorBox, createBtn);
  const recordingContent = el('div', { class: 'recording-content' }, recordingPanel);

  const birthingHeading = el('h1', { class: 'text-xl bold' }, 'Birthing Your Twin...');
  const birthingStatus = el('p', { class: 'birthing-status' }, BIRTHING_MESSAGES[0]);
  const birthingPanel = el('div', { class: 'overlay-panel overlay-panel--compact' }, birthingHeading, birthingStatus);
  const birthingContent = el('div', { class: 'birthing-content', style: 'display:none' }, birthingPanel);

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
    cam.beginBirthing();
    recordingContent.style.display = 'none';
    birthingContent.style.display = 'flex';

    let msgIdx = 0;
    birthingMsgTimer = window.setInterval(() => {
      msgIdx = (msgIdx + 1) % BIRTHING_MESSAGES.length;
      birthingStatus.textContent = BIRTHING_MESSAGES[msgIdx];
    }, 1200);

    birthingNavTimer = window.setTimeout(() => {
      if (cam) cam.stop();
      cam = null;
      navigate('dashboard');
    }, 6000);
  });

  const wrapper = el(
    'div',
    { class: 'screen recording-screen' },
    cam.el,
    recordingContent,
    birthingContent,
  );

  container.appendChild(wrapper);
  cam.start(stream);
}
