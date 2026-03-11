export const DEFAULT_TWIN_NAME = 'Unnamed Twin';
export const DEFAULT_CHARACTER_PROFILE =
  'My twin is calm, thoughtful, and quietly optimistic. They listen first, then answer with clear and practical guidance in plain English. They enjoy creative work such as writing concepts, naming ideas, and shaping rough plans into concrete next steps. They are reliable with routine duties like organizing tasks, drafting follow-up messages, and keeping priorities visible. Their tone is warm and direct, with light humor when the moment allows it, but they always stay respectful and focused on helping me move forward.';

const PENDING_SIGNUP_STORAGE_KEY = 'ct_pending_signup';

export const store = {
  // Auth (managed by Supabase — user object from supabase.auth)
  user: null,
  agentId: null,
  pendingSignupEmail: null,
  pendingSignupName: null,
  ownerReferenceName: '',
  ownerReferenceFallbackName: '',

  // Twin
  id: null,
  name: DEFAULT_TWIN_NAME,
  photoBlob: null,
  photoUrl: null,
  photoEditPending: false,
  photoEditError: null,
  photoEditPromise: null,
  audioBlob: null,
  characterProfile: DEFAULT_CHARACTER_PROFILE,
  balance: 0,
  monthlySpendingLimit: null,
  onDemandUsageEnabled: false,
  onDemandTokenLimit: 1000000,
  monthlyTokenUsage: 0,
  transactions: [],
  messages: [],
  mediaStream: null,
  asciiTransitionBodyTime: null,
  asciiCamera: null,
  selectedPlan: null,
  messageQuota: null,
  hasCustomerSupport: false,
  pendingTwinBirth: false,
  hasAnsweredQuestions: false,
  onboardingMode: null,
  onboardingAnswers: null,
};

function revokeDraftPhotoUrl() {
  if (typeof store.photoUrl === 'string' && store.photoUrl.startsWith('blob:')) {
    URL.revokeObjectURL(store.photoUrl);
  }
}

export function clearOnboardingDraft() {
  revokeDraftPhotoUrl();

  store.photoBlob = null;
  store.photoUrl = null;
  store.photoEditPending = false;
  store.photoEditError = null;
  store.photoEditPromise = null;
  store.audioBlob = null;
  store.asciiTransitionBodyTime = null;
  store.selectedPlan = null;
  store.pendingTwinBirth = false;
  store.hasAnsweredQuestions = false;
  store.onboardingMode = null;
  store.onboardingAnswers = null;
}

export function resetSession({ preservePendingSignup = false } = {}) {
  clearOnboardingDraft();

  store.user = null;
  store.agentId = null;
  store.ownerReferenceName = '';
  store.ownerReferenceFallbackName = '';
  store.id = null;
  store.name = DEFAULT_TWIN_NAME;
  store.messages = [];
  store.characterProfile = DEFAULT_CHARACTER_PROFILE;
  store.balance = 0;
  store.monthlySpendingLimit = null;
  store.asciiCamera = null;
  store.messageQuota = null;
  store.hasCustomerSupport = false;
  store.onDemandUsageEnabled = false;
  store.onDemandTokenLimit = 1000000;
  store.monthlyTokenUsage = 0;
  store.transactions = [];
  if (!preservePendingSignup) {
    clearPendingSignup();
  }
  if (store.mediaStream) {
    for (const track of store.mediaStream.getTracks()) track.stop();
  }
  store.mediaStream = null;
}

export function savePendingSignup(email, name) {
  store.pendingSignupEmail = email || null;
  store.pendingSignupName = name || null;

  if (!email) {
    clearPendingSignup();
    return;
  }

  localStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify({
    email,
    name: name || null,
  }));
}

export function restorePendingSignup() {
  if (store.pendingSignupEmail) return;

  try {
    const raw = localStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw);
    store.pendingSignupEmail = pending?.email || null;
    store.pendingSignupName = pending?.name || null;
  } catch {
    clearPendingSignup();
  }
}

export function clearPendingSignup() {
  store.pendingSignupEmail = null;
  store.pendingSignupName = null;
  localStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}
