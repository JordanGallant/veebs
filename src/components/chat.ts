import { el, on, clear } from '../lib/dom.js';
import { store, notify, type ChatMessage } from '../lib/store.js';

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

export function createChat(parent: HTMLElement): () => void {
  const log = el('div', { class: 'chat-log' });
  const input = el('input', { class: 'input', type: 'text', placeholder: 'Type a message...' }) as HTMLInputElement;
  const sendBtn = el('button', { class: 'btn' }, 'Send');
  const row = el('div', { class: 'chat-input-row' }, input, sendBtn);
  const wrapper = el('div', { class: 'tab-content' }, log, row);
  parent.appendChild(wrapper);

  function renderMessages(): void {
    clear(log);
    for (const msg of store.messages) {
      const cls = msg.role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg chat-msg--twin';
      log.appendChild(el('div', { class: cls }, msg.content));
    }
    log.scrollTop = log.scrollHeight;
  }

  function send(): void {
    const text = input.value.trim();
    if (!text) return;

    store.messages.push({ role: 'user', content: text });
    notify();
    input.value = '';
    renderMessages();

    sendBtn.setAttribute('disabled', '');

    setTimeout(() => {
      const reply = generateReply(text);
      store.messages.push({ role: 'twin', content: reply });
      notify();
      renderMessages();
      sendBtn.removeAttribute('disabled');
    }, 600 + Math.random() * 800);
  }

  on(sendBtn, 'click', send);
  on(input, 'keydown', (e) => {
    if (e.key === 'Enter') send();
  });

  renderMessages();

  const unsub = () => {};
  return unsub;
}

function generateReply(userMsg: string): string {
  const lower = userMsg.toLowerCase();
  const traits = store.traits;

  if (lower.includes('name')) {
    return `My name is ${store.name}. Nice to formally introduce myself!`;
  }
  if (lower.includes('hobby') || lower.includes('hobbies')) {
    return traits.Creativity > 60
      ? "I love creative pursuits! Maybe we could brainstorm something together?"
      : "I'm more of a practical thinker. What tasks can I tackle for you?";
  }
  if (lower.includes('help') || lower.includes('task') || lower.includes('duty')) {
    return traits.Energy > 60
      ? "I'm full of energy and ready to take things on! Just say the word."
      : "I'll pace myself but I'll get it done. What do you need?";
  }
  if (lower.includes('how are you') || lower.includes('feeling')) {
    return traits.Humor > 60
      ? "Running at peak performance -- which for a digital twin means I haven't crashed yet!"
      : "I'm operational and ready to assist.";
  }

  return MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
}
