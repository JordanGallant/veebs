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

function buildAnswerRecord(answers) {
  return {
    ownerReferenceName: store.ownerReferenceName || '',
    goals: answers[0] || '',
    hobbies: answers[1] || '',
    priorities: answers[2] || '',
    duties: answers[3] || '',
  };
}

function render(container) {
  cam = createAsciiCamera({
    transitionBodyTime: store.asciiTransitionBodyTime,
  });
  store.asciiTransitionBodyTime = null;

  const heading = el('h1', { class: 'text-lg bold recording-heading' }, '');
  const helpToggle = el('button', {
    class: 'recording-help-toggle help-toggle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'questions-help',
    'aria-label': 'Why these questions?',
  }, '?');
  const prompt = el(
    'p',
    { class: 'secondary text-sm recording-help-text help-text' },
    'These answers seed your twin character. No microphone or camera access is used in this mode.',
  );
  const promptBody = el('div', { class: 'recording-help-body help-body' }, prompt);
  const promptWrap = el('div', { class: 'recording-help-wrap help-wrap', id: 'questions-help' }, promptBody);
  const headingRow = el('div', { class: 'recording-heading-row' }, heading, helpToggle);
  const inputLabel = el('label', {
    class: 'bold question-field-label',
    for: 'questions-owner-reference-name',
    style: 'display:none',
  });
  const ownerInput = el('input', {
    id: 'questions-owner-reference-name',
    class: 'input question-input',
    type: 'text',
    style: 'display:none',
    value: store.ownerReferenceName || '',
  });

  const input = el('textarea', {
    id: 'questions-answer-input',
    class: 'input question-textarea',
    style: 'display:none',
  });
  const fieldStatus = el('p', { class: 'secondary text-sm question-field-status' });
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
    inputLabel,
    ownerInput,
    input,
    fieldStatus,
    controls,
  );
  const content = el('div', { class: 'recording-content screen-content' }, panel);
  const wrapper = el(
    'div',
    { class: 'screen recording-screen screen-shell' },
    content,
  );

  const layer = getAsciiLayer();
  if (layer) {
    layer.innerHTML = '';
    layer.appendChild(cam.el);
  }

  const answers = new Array(QUESTIONS.length).fill('');
  let ownerStepComplete = false;
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
    ownerStepComplete = true;
    fieldStatus.textContent = '';
    inputLabel.textContent = 'Your answer';
    inputLabel.setAttribute('for', 'questions-answer-input');
    inputLabel.style.display = '';
    ownerInput.style.display = 'none';
    input.style.display = '';
    input.value = answers[questionIdx];
    input.focus();
    typeHeading(QUESTIONS[questionIdx], true);
    flowBtn.textContent = questionIdx === QUESTIONS.length - 1 ? 'Create your twin' : 'Next';
  }

  function showOwnerStep() {
    ownerStepComplete = false;
    questionIdx = -1;
    inputLabel.textContent = 'How should your twin call you?';
    inputLabel.setAttribute('for', 'questions-owner-reference-name');
    inputLabel.style.display = '';
    ownerInput.style.display = '';
    input.style.display = 'none';
    fieldStatus.textContent = '';
    ownerInput.focus();
    typeHeading('How should your twin call you?', true);
    flowBtn.textContent = 'Continue';
  }

  on(flowBtn, 'click', () => {
    if (questionIdx === -1) {
      if (!ownerStepComplete) {
        if (!inputLabel.textContent) {
          showOwnerStep();
          return;
        }

        const ownerReferenceName = ownerInput.value.trim();
        if (!ownerReferenceName) {
          fieldStatus.textContent = 'Please tell your twin how to address you.';
          return;
        }

        store.ownerReferenceName = ownerReferenceName;
        store.ownerReferenceFallbackName = ownerReferenceName;
        fieldStatus.textContent = '';
        showQuestion(0);
        return;
      }

      showQuestion(0);
      return;
    }

    answers[questionIdx] = input.value.trim();
    if (questionIdx < QUESTIONS.length - 1) {
      showQuestion(questionIdx + 1);
      return;
    }

    // Soul is generated server-side after birthing — just store answers
    store.onboardingMode = 'typed';
    store.onboardingAnswers = buildAnswerRecord(answers);
    store.hasAnsweredQuestions = true;
    panel.classList.remove('is-visible');
    panel.classList.add('is-exiting');
    exitTimer = window.setTimeout(() => {
      store.asciiTransitionBodyTime = cam ? cam.captureBodyVideoTime() : null;
      navigate('auth');
    }, 420);
  });

  container.appendChild(wrapper);
  cam.startBody();
  revealTimer = window.setTimeout(() => {
    panel.classList.add('is-visible');
    typeHeading('Answer some questions', false);
  }, 420);
}
