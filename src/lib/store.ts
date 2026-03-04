export interface TwinData {
  id: number | null;
  name: string;
  photoBlob: Blob | null;
  audioBlob: Blob | null;
  traits: Record<string, number>;
  balance: number;
  transactions: Transaction[];
  messages: ChatMessage[];
  mediaStream: MediaStream | null;
}

export interface Transaction {
  amount: number;
  type: 'deposit';
  date: string;
}

export interface ChatMessage {
  role: 'user' | 'twin';
  content: string;
}

type Listener = () => void;

const listeners: Listener[] = [];

export const store: TwinData = {
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

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function notify(): void {
  for (const fn of listeners) fn();
}
