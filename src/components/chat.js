import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';

const MOCK_REPLIES = [
  "That's interesting! Tell me more about that.",
  "I'll keep that in mind. What else should I know?",
  "Got it. I'm learning a lot about you.",
  "I can definitely help with that.",
  "Noted! I'm building my understanding of you.",
  "That resonates with my personality matrix.",
  "Fascinating. Let's explore that further.",
  "I appreciate you sharing that with me.",
  "My circuits are buzzing with that info.",
  "Consider it done -- well, virtually at least.",
];

export function createChat(parent) {
  const log = el('div', { class: 'chat-log' });
  const input = el('input', { class: 'input', type: 'text', placeholder: 'Type a message...' });
  const sendBtn = el('button', { class: 'btn' }, 'Send');
  const row = el('div', { class: 'chat-input-row' }, input, sendBtn);
  const wrapper = el('div', { class: 'tab-content' }, log, row);
  parent.appendChild(wrapper);

  function renderMessages() {
    clear(log);
    for (const msg of store.messages) {
      const cls = msg.role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg chat-msg--twin';
      log.appendChild(el('div', { class: cls }, msg.content));
    }
    log.scrollTop = log.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (!text) return;

    store.messages.push({ role: 'user', content: text });
    input.value = '';
    renderMessages();

    sendBtn.setAttribute('disabled', '');

    setTimeout(() => {
      const reply = generateReply(text);
      store.messages.push({ role: 'twin', content: reply });
      renderMessages();
      sendBtn.removeAttribute('disabled');
    }, 600 + Math.random() * 800);
  }

  on(sendBtn, 'click', send);
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter') send();
  });

  renderMessages();
}

function generateReply(userMsg) {
  const lower = userMsg.toLowerCase();
  const profile = (store.characterProfile || '').trim();

  if (lower.includes('name')) {
    return `My name is ${store.name}. Nice to formally introduce myself!`;
  }
  if (lower.includes('hobby') || lower.includes('hobbies')) {
    return pickProfileSentence(profile, ['enjoy', 'hobby', 'creative', 'writing', 'idea'])
      || 'I enjoy a mix of creative and practical work. Tell me what you want to focus on first.';
  }
  if (lower.includes('help') || lower.includes('task') || lower.includes('duty')) {
    return pickProfileSentence(profile, ['help', 'task', 'duty', 'organizing', 'routine', 'guidance'])
      || 'I can help with planning, organizing, and turning rough ideas into next steps.';
  }
  if (lower.includes('how are you') || lower.includes('feeling')) {
    return pickProfileSentence(profile, ['calm', 'optimistic', 'warm', 'tone', 'humor'])
      || "I'm calm, focused, and ready to help.";
  }

  return MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
}

function pickProfileSentence(profile, keywords) {
  if (!profile) return '';
  const sentences = profile
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const match = sentences.find((sentence) => {
    const lower = sentence.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });
  return match || sentences[0] || '';
}
