import { el, on } from '../lib/dom.js';
import { navigate, registerScreen } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { createAudioRecorder } from '../components/audio-recorder.js';
import { animateTypewriter } from '../lib/typewriter.js';

const BIRTHING_MESSAGES = [
  'Analyzing voice patterns...',
  'Mapping facial features...',
  'Generating personality matrix...',
  'Initializing neural pathways...',
  'Calibrating empathy circuits...',
  'Bootstrapping consciousness...',
];

const TWIN_QUESTIONS = [
  'What are your goals in life?',
  'Which hobbies and interests shape who you are?',
  'What is most important to you right now?',
  'Which duties should your twin handle for you?',
];

let cam = null;
let birthingMsgTimer = 0;
let birthingNavTimer = 0;
let birthingShowTimer = 0;
let birthingExitTimer = 0;
let stopQuestionType = null;
let stopBirthingType = null;

export function registerRecording() {
  registerScreen('recording', {
    render,
    cleanup() {
      if (cam) cam.stop();
      cam = null;
      clearInterval(birthingMsgTimer);
      clearTimeout(birthingNavTimer);
      clearTimeout(birthingShowTimer);
      clearTimeout(birthingExitTimer);
      if (stopQuestionType) stopQuestionType();
      if (stopBirthingType) stopBirthingType();
      stopQuestionType = null;
      stopBirthingType = null;
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

  cam = createAsciiCamera({
    mirror: true,
    rain: true,
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-lg bold recording-heading' }, '');
  const helpToggle = el('button', {
    class: 'recording-help-toggle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'recording-help',
    'aria-label': 'Recording tips',
  }, '?');
  const prompt = el(
    'p',
    { class: 'secondary text-sm recording-help-text' },
    'These answers seed your twin character. This process is recorded to capture how you look and sound.',
  );
  const promptBody = el('div', { class: 'recording-help-body' }, prompt);
  const promptWrap = el('div', { class: 'recording-help-wrap', id: 'recording-help' }, promptBody);
  const headingRow = el('div', { class: 'recording-heading-row' }, heading, helpToggle);

  const recDot = el('span', { class: 'rec-dot', style: 'display:none' });
  const timerEl = el('span', { class: 'rec-timer' }, '00:00');
  const status = el('div', { class: 'rec-status' }, recDot, timerEl);
  const flowBtn = el('button', { class: 'btn' }, 'Start');
  const controls = el('div', { class: 'rec-controls rec-controls--compact' }, flowBtn);
  const errorBox = el('p', { class: 'error', style: 'display:none' });

  on(helpToggle, 'click', () => {
    const isOpen = promptWrap.classList.toggle('is-open');
    helpToggle.setAttribute('aria-expanded', String(isOpen));
  });

  const recordingPanel = el(
    'div',
    { class: 'overlay-panel overlay-panel--compact overlay-shell recording-panel' },
    headingRow,
    promptWrap,
    status,
    controls,
    errorBox,
  );
  const recordingContent = el('div', { class: 'recording-content' }, recordingPanel);

  const birthingHeading = el('h1', { class: 'text-xl bold birthing-heading' }, '');
  const birthingStatus = el('p', { class: 'birthing-status' }, BIRTHING_MESSAGES[0]);
  const birthingPanel = el('div', { class: 'overlay-panel overlay-panel--compact overlay-shell' }, birthingHeading, birthingStatus);
  const birthingContent = el('div', { class: 'birthing-content', style: 'display:none' }, birthingPanel);

  let recorder = null;
  let timerInterval = 0;
  let elapsed = 0;
  let questionIdx = -1;
  let isRecording = false;

  function typeQuestionHeading(text, swap) {
    if (stopQuestionType) stopQuestionType();
    stopQuestionType = animateTypewriter(heading, text, {
      speed: 20,
      swap,
      swapDuration: 120,
    });
  }

  function enterBirthing() {
    cam.beginBirthing();
    recordingPanel.classList.remove('is-visible');
    recordingPanel.classList.add('is-exiting');
    birthingShowTimer = window.setTimeout(() => {
      recordingContent.style.display = 'none';
      birthingContent.style.display = 'flex';
      window.requestAnimationFrame(() => {
        birthingPanel.classList.add('is-visible');
        if (stopBirthingType) stopBirthingType();
        stopBirthingType = animateTypewriter(birthingHeading, 'Birthing Your Twin...', {
          delay: 70,
          speed: 30,
          swap: false,
        });
      });
    }, 420);

    let msgIdx = 0;
    birthingMsgTimer = window.setInterval(() => {
      msgIdx = (msgIdx + 1) % BIRTHING_MESSAGES.length;
      birthingStatus.textContent = BIRTHING_MESSAGES[msgIdx];
    }, 1200);

    birthingNavTimer = window.setTimeout(() => {
      birthingPanel.classList.remove('is-visible');
      birthingPanel.classList.add('is-exiting');
      birthingExitTimer = window.setTimeout(() => {
        if (cam) cam.stop();
        cam = null;
        navigate('dashboard');
      }, 420);
    }, 5600);
  }

  on(flowBtn, 'click', async () => {
    errorBox.style.display = 'none';

    if (!isRecording) {
      recorder = createAudioRecorder(stream);
      try {
        recorder.start();
      } catch {
        recorder = null;
        recDot.style.display = 'none';
        flowBtn.textContent = 'Start';
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
      cam.setWave(true);
      isRecording = true;
      questionIdx = 0;
      typeQuestionHeading(TWIN_QUESTIONS[questionIdx], true);
      flowBtn.textContent = 'Next';

      elapsed = 0;
      timerEl.textContent = '00:00';
      recDot.style.display = '';
      timerInterval = window.setInterval(() => {
        elapsed++;
        timerEl.textContent = formatTime(elapsed);
      }, 1000);
      return;
    }

    if (questionIdx < TWIN_QUESTIONS.length - 1) {
      questionIdx++;
      typeQuestionHeading(TWIN_QUESTIONS[questionIdx], true);
      flowBtn.textContent = questionIdx === TWIN_QUESTIONS.length - 1 ? 'Create your twin' : 'Next';
      return;
    }

    flowBtn.setAttribute('disabled', '');

    try {
      const audioBlob = await recorder.stop();
      store.audioBlob = audioBlob;
    } catch {
      flowBtn.removeAttribute('disabled');
      errorBox.style.display = '';
      errorBox.textContent =
        'Could not finalize recording. Try again after closing other apps that may be using your microphone.';
      return;
    }

    clearInterval(timerInterval);
    recDot.style.display = 'none';
    cam.setWave(false);
    enterBirthing();
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
  window.requestAnimationFrame(() => {
    recordingPanel.classList.add('is-visible');
    typeQuestionHeading('Answer some questions', false);
  });
}
