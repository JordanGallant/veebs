export const store = {
  id: null,
  name: 'Unnamed Twin',
  photoBlob: null,
  photoUrl: null,
  photoEditPending: false,
  photoEditError: null,
  photoEditPromise: null,
  audioBlob: null,
  characterProfile:
    'My twin is calm, thoughtful, and quietly optimistic. They listen first, then answer with clear and practical guidance in plain English. They enjoy creative work such as writing concepts, naming ideas, and shaping rough plans into concrete next steps. They are reliable with routine duties like organizing tasks, drafting follow-up messages, and keeping priorities visible. Their tone is warm and direct, with light humor when the moment allows it, but they always stay respectful and focused on helping me move forward.',
  balance: 0,
  monthlySpendingLimit: null,
  transactions: [],
  messages: [],
  mediaStream: null,
  asciiTransitionBodyTime: null,
  asciiCamera: null,
  selectedPlan: null,
  messageQuota: null,
  hasCustomerSupport: false,
  pendingTwinBirth: false,
};

export function resetSession() {
  store.messages = [];
  store.photoBlob = null;
  store.photoUrl = null;
  store.photoEditPending = false;
  store.photoEditError = null;
  store.photoEditPromise = null;
  store.audioBlob = null;
  store.asciiTransitionBodyTime = null;
  store.asciiCamera = null;
  store.selectedPlan = null;
  store.messageQuota = null;
  store.hasCustomerSupport = false;
  store.pendingTwinBirth = false;
  if (store.mediaStream) {
    for (const track of store.mediaStream.getTracks()) track.stop();
  }
  store.mediaStream = null;
}
