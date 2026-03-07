import { el, on } from '../lib/dom.js';
import { navigate, registerScreen, getAsciiLayer } from '../lib/router.js';
import { store } from '../lib/store.js';
import { createAsciiCamera } from '../components/ascii-camera.js';
import { animateTypewriter } from '../lib/typewriter.js';

const QUESTIONS = [
  'What are your goals in life?',
  'Which hobbies and interests shape who you are?',
  'What is most important to you right now?',
  'Which duties should your twin handle for you?',
];

let cam = null;
let revealTimer = 0;
let exitTimer = 0;
let stopHeadingType = null;

export function registerQuestions() {
  registerScreen('questions', {
    render,
    cleanup() {
      if (cam) {
        cam.stop();
        if (cam.el.parentNode) cam.el.parentNode.removeChild(cam.el);
      }
      cam = null;
      clearTimeout(revealTimer);
      clearTimeout(exitTimer);
      if (stopHeadingType) stopHeadingType();
      stopHeadingType = null;
    },
  });
}

function buildCharacterProfile(answers) {
  const [goals, hobbies, important, duties] = answers.map((text) => text || 'Not provided.');
  return [
    'My twin should follow these user notes:',
    `Goals in life: ${goals}`,
    `Hobbies and interests: ${hobbies}`,
    `Most important right now: ${important}`,
    `Duties to handle: ${duties}`,
    'Keep responses clear, practical, and aligned with these priorities.',
  ].join(' ');
}

function render(container) {
  cam = createAsciiCamera({
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-lg bold recording-heading' }, '');
  const helpToggle = el('button', {
    class: 'recording-help-toggle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'questions-help',
    'aria-label': 'Why these questions?',
  }, '?');
  const prompt = el(
    'p',
    { class: 'secondary text-sm recording-help-text' },
    'These answers seed your twin character. No microphone or camera access is used in this mode.',
  );
  const promptBody = el('div', { class: 'recording-help-body' }, prompt);
  const promptWrap = el('div', { class: 'recording-help-wrap', id: 'questions-help' }, promptBody);
  const headingRow = el('div', { class: 'recording-heading-row' }, heading, helpToggle);

  const input = el('textarea', {
    class: 'input question-textarea',
    style: 'display:none',
    placeholder: 'Type your answer...',
  });
  const flowBtn = el('button', { class: 'btn' }, 'Start');
  const controls = el('div', { class: 'rec-controls rec-controls--compact' }, flowBtn);

  on(helpToggle, 'click', () => {
    const isOpen = promptWrap.classList.toggle('is-open');
    helpToggle.setAttribute('aria-expanded', String(isOpen));
  });

  const panel = el(
    'div',
    { class: 'overlay-panel overlay-panel--compact overlay-shell recording-panel' },
    headingRow,
    promptWrap,
    input,
    controls,
  );
  const content = el('div', { class: 'recording-content' }, panel);
  const wrapper = el(
    'div',
    { class: 'screen recording-screen' },
    content,
  );

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  const answers = new Array(QUESTIONS.length).fill('');
  let questionIdx = -1;

  function typeHeading(text, swap) {
    if (stopHeadingType) stopHeadingType();
    stopHeadingType = animateTypewriter(heading, text, {
      speed: 20,
      swap,
      swapDuration: 120,
    });
  }

  function showQuestion(nextIndex) {
    questionIdx = nextIndex;
    input.style.display = '';
    input.value = answers[questionIdx];
    input.focus();
    typeHeading(QUESTIONS[questionIdx], true);
    flowBtn.textContent = questionIdx === QUESTIONS.length - 1 ? 'Create your twin' : 'Next';
  }

  on(flowBtn, 'click', () => {
    if (questionIdx === -1) {
      showQuestion(0);
      return;
    }

    answers[questionIdx] = input.value.trim();
    if (questionIdx < QUESTIONS.length - 1) {
      showQuestion(questionIdx + 1);
      return;
    }

    store.characterProfile = buildCharacterProfile(answers);
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    exitTimer = window.setTimeout(() => {
      store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
      navigate('pricing');
    }, 420);
  });

  container.appendChild(wrapper);
  cam.startBody();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    typeHeading('Answer some questions', false);
  }, 420);
}
