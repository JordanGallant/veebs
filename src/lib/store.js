export const DEFAULT_TWIN_NAME = 'Unnamed Twin';
// No default — soul is generated server-side via /api/agents/generate-soul

const PENDING_SIGNUP_STORAGE_KEY = 'ct_pending_signup';


export const store = {
  // Auth (managed by Supabase — user object from supabase.auth)
  user: null,
  agentId: null,
  pendingSignupEmail: null,
  pendingSignupName: null,
  ownerReferenceName: '',
  ownerReferenceFallbackName: '',

  // Agents API (agents.jgsleepy.xyz)
  localAgentId: null,
  solanaAddress: null,
  evmAddress: null,
  agentState: 'sleeping',
  agentTools: [],
  erc8004AgentId: null,
  satiAgentId: null,
  rocks: 0,
  lastActive: null,

  // Twin
  id: null,
  name: DEFAULT_TWIN_NAME,
  photoBlob: null,
  photoUrl: null,
  photoEditPending: false,
  photoEditError: null,
  photoEditPromise: null,
  audioBlob: null,
  characterProfile: '',
  balance: 0,
  monthlySpendingLimit: null,
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

  // Voice
  voiceRefAudioBlob: null,
  voiceTranscript: null,
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
  store.localAgentId = null;
  store.solanaAddress = null;
  store.evmAddress = null;
  store.agentState = 'sleeping';
  store.agentTools = [];
  store.erc8004AgentId = null;
  store.satiAgentId = null;
  store.rocks = 0;
  store.lastActive = null;
  store.ownerReferenceName = '';
  store.ownerReferenceFallbackName = '';
  store.id = null;
  store.name = DEFAULT_TWIN_NAME;
  store.messages = [];
  store.characterProfile = '';
  store.balance = 0;
  store.monthlySpendingLimit = null;
  store.asciiCamera = null;
  store.messageQuota = null;
  store.hasCustomerSupport = false;
  store.monthlyTokenUsage = 0;
  store.transactions = [];
  store.voiceRefAudioBlob = null;
  store.voiceTranscript = null;
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

