const listeners = [];

export const store = {
  id: null,
  name: 'Unnamed Twin',
  photoBlob: null,
  audioBlob: null,
  characterProfile:
    'My twin is calm, thoughtful, and quietly optimistic. They listen first, then answer with clear and practical guidance in plain English. They enjoy creative work such as writing concepts, naming ideas, and shaping rough plans into concrete next steps. They are reliable with routine duties like organizing tasks, drafting follow-up messages, and keeping priorities visible. Their tone is warm and direct, with light humor when the moment allows it, but they always stay respectful and focused on helping me move forward.',
  balance: 0,
  transactions: [],
  messages: [],
  mediaStream: null,
};

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function notify() {
  for (const fn of listeners) fn();
}
