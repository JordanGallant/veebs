const listeners = [];

export const store = {
  id: null,
  name: 'Unnamed Twin',
  photoBlob: null,
  audioBlob: null,
  traits: {
    Creativity: 65,
    Humor: 50,
    Formality: 40,
    Energy: 70,
    Empathy: 75,
  },
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
