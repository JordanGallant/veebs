/**
 * API client — backed by Supabase for auth/database/storage and
 * agents.jgsleepy.xyz for agent brains, wallets, and chat.
 */

import { supabase } from './supabase.js';
import { store, resetSession } from './store.js';

const ONBOARDING_PHOTO_BUCKET = 'onboarding-photos';
const ONBOARDING_AUDIO_BUCKET = 'onboarding-audio';
const VOICE_MEMOS_BUCKET = 'voice-memos';

const AGENTS_API = 'https://agents.jgsleepy.xyz';
const PENDING_PRICING_SESSION_STORAGE_KEY = 'ct_pending_checkout_session_id';

// ── Agents API helpers (no auth needed — endpoints use Supabase IDs) ──

async function agentsApiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(`${AGENTS_API}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Agents API error ${res.status}`);
  return body;
}

async function localApiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Local API error ${res.status}`);
  return body;
}

export function isEmailVerified(user = store.user) {
  if (!user) return false;
  if (Object.prototype.hasOwnProperty.call(user, 'email_confirmed_at')) {
    return Boolean(user.email_confirmed_at);
  }
  return Boolean(user.confirmed_at);
}

export async function getActiveSessionUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  if (!session?.user) {
    store.user = null;
    return null;
  }

  store.user = session.user;
  return session.user;
}

export async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return session?.access_token || null;
}

// ── Auth ──

export async function register(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || 'CyberTwin User' } },
  });
  if (error) throw new Error(error.message);

  store.user = data.session?.user || null;

  return {
    ...data,
    needsEmailConfirmation: !data.session,
  };
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);

  store.user = data.session?.user || data.user || null;

  return data;
}

export async function verifySignupCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw new Error(error.message);

  store.user = data.session?.user || data.user || null;
  const sessionUser = await getActiveSessionUser();
  if (!sessionUser) {
    throw new Error('Email verification succeeded but no user session was returned.');
  }
  return data;
}

export async function resendSignupCode(email) {
  const { error } = await supabase.auth.resend({
    email,
    type: 'signup',
  });
  if (error) throw new Error(error.message);
}

export async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem('ct_pending_plan');
  clearPendingPricingCheckoutSessionId();
  resetSession();
}

export async function restoreSession() {
  const sessionUser = await getActiveSessionUser();
  if (!sessionUser) {
    // Keep pending signup context so verify-email can survive a page refresh.
    resetSession({ preservePendingSignup: true });
    return false;
  }
  const pendingOwnerReferenceName = store.ownerReferenceName;
  const pendingOwnerReferenceFallbackName = store.ownerReferenceFallbackName;

  store.ownerReferenceName = normalizeOwnerReferenceName(pendingOwnerReferenceName);
  store.ownerReferenceFallbackName = getOwnerReferenceFallbackName(
    pendingOwnerReferenceFallbackName,
    sessionUser.user_metadata?.display_name,
  );

  try {
    const agents = await getMyAgents();
    if (agents.length > 0) {
      store.agentId = agents[0].id;
      if (agents[0].name) store.name = agents[0].name;
      if (agents[0].personality) store.characterProfile = agents[0].personality;
      if (agents[0].solana_address) store.solanaAddress = agents[0].solana_address;
      if (agents[0].evm_address) store.evmAddress = agents[0].evm_address;
      if (agents[0].local_agent_id) store.localAgentId = agents[0].local_agent_id;
      if (agents[0].agent_state) store.agentState = agents[0].agent_state;
      if (agents[0].erc8004_agent_id) store.erc8004AgentId = agents[0].erc8004_agent_id;
      if (agents[0].sati_agent_id) store.satiAgentId = agents[0].sati_agent_id;
      if (agents[0].rocks != null) store.rocks = agents[0].rocks;
      if (agents[0].last_active) store.lastActive = agents[0].last_active;
    }
  } catch {
    // Agent will be created later during onboarding
  }

  try {
    const profile = await getProfile();
    const storedOwnerReferenceName = normalizeOwnerReferenceName(profile?.owner_reference_name);
    if (storedOwnerReferenceName) {
      store.ownerReferenceName = storedOwnerReferenceName;
    }
    store.ownerReferenceFallbackName = getOwnerReferenceFallbackName(
      profile?.display_name,
      pendingOwnerReferenceFallbackName,
      sessionUser.user_metadata?.display_name,
    );
  } catch {
    // Profile row can be created later during onboarding/settings.
  }

  return true;
}

// ── Agents ──

export async function createAgent(name, description, personality) {
  const { data, error } = await supabase
    .from('agents')
    .insert({
      user_id: store.user.id,
      name,
      description: description || '',
      personality: personality || '',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  store.agentId = data.id;

  // Wallet creation skipped — not needed for hackathon demo

  return data;
}

export async function getMyAgents() {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', store.user.id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function loadOrCreateAgent(name, characterProfile) {
  try {
    const agents = await getMyAgents();
    if (agents.length > 0) {
      store.agentId = agents[0].id;
      if (agents[0].name) store.name = agents[0].name;
      if (agents[0].personality) store.characterProfile = agents[0].personality;
      return agents[0];
    }
  } catch {
    // Fall through to create
  }
  return createAgent(name, 'CyberTwin agent', characterProfile || '');
}

export async function isAgentNameTaken(name, excludeAgentId) {
  const { data, error } = await supabase
    .from('agents')
    .select('id')
    .ilike('name', name)
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return false;
  // If the only match is our own agent, it's fine
  return excludeAgentId ? data[0].id !== excludeAgentId : true;
}

export async function saveAgentName(name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Twin name cannot be empty.');
  }

  let agentId = store.agentId;
  if (!agentId) {
    const agent = await loadOrCreateAgent(trimmedName, store.characterProfile);
    agentId = agent.id;
  }

  // Check uniqueness
  const taken = await isAgentNameTaken(trimmedName, agentId);
  if (taken) {
    throw new Error('That name is already taken. Choose a unique name.');
  }

  const { data, error } = await supabase
    .from('agents')
    .update({ name: trimmedName })
    .eq('id', agentId)
    .select('id, name')
    .single();
  if (error) throw new Error(error.message);

  store.agentId = data.id;
  store.name = data.name || trimmedName;
  return data;
}

export async function saveAgentCharacterProfile(characterProfile) {
  const trimmedProfile = characterProfile.trim();
  if (!trimmedProfile) {
    throw new Error('Character profile cannot be empty.');
  }

  let agentId = store.agentId;
  if (!agentId) {
    const agent = await loadOrCreateAgent(store.name || 'My Twin', trimmedProfile);
    agentId = agent.id;
  }

  const { data, error } = await supabase
    .from('agents')
    .update({ personality: trimmedProfile })
    .eq('id', agentId)
    .select('id, personality')
    .single();
  if (error) throw new Error(error.message);

  store.agentId = data.id;
  store.characterProfile = data.personality || trimmedProfile;
  return data;
}

// ── Profile Image ──

export async function saveProfileImage(imagePath) {
  const { error } = await supabase
    .from('agents')
    .update({ profile_image_url: imagePath })
    .eq('id', store.agentId);
  if (error) throw new Error(error.message);
}

export async function getProfileImage() {
  const { data, error } = await supabase
    .from('agents')
    .select('profile_image_url')
    .eq('id', store.agentId)
    .single();
  if (error) throw new Error(error.message);

  if (!data?.profile_image_url) return null;
  if (/^https?:\/\//.test(data.profile_image_url)) return data.profile_image_url;

  const { data: signed, error: signedError } = await supabase.storage
    .from('profile-images')
    .createSignedUrl(data.profile_image_url, 60 * 60);
  if (signedError) throw new Error(signedError.message);
  return signed?.signedUrl || null;
}

// ── Chat ──

export async function sendMessage(message) {
  if (!store.agentId || !store.user) {
    throw new Error('Not signed in');
  }

  const data = await agentsApiFetch('/api/agents/supabase-chat', {
    method: 'POST',
    body: JSON.stringify({
      supabase_agent_id: store.agentId,
      supabase_user_id: store.user.id,
      message,
    }),
  });

  // Backend already saves messages to Supabase
  return {
    response: data.response || "I'm not sure how to respond to that.",
    message_id: data.message_id || null,
    voice_reply: data.voice_reply || false,
  };
}

export async function getChatHistory() {
  if (!store.agentId) return [];

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('agent_id', store.agentId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

// ── Profile ──

export async function updateProfile(fields) {
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', store.user.id);
  if (error) throw new Error(error.message);
}

export async function getProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', store.user.id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveOnboardingProfile(fields) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: store.user.id,
      ...fields,
    }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function saveOwnerReferenceName(value) {
  const trimmedName = normalizeOwnerReferenceName(value);
  if (!trimmedName) {
    throw new Error('This name cannot be empty.');
  }

  await saveOnboardingProfile({
    owner_reference_name: trimmedName,
    updated_at: new Date().toISOString(),
  });

  store.ownerReferenceName = trimmedName;
  store.ownerReferenceFallbackName = trimmedName;
  return trimmedName;
}

export async function syncOnboardingData() {
  const sessionUser = await getActiveSessionUser();
  if (!sessionUser) {
    throw new Error('You must be signed in before onboarding data can be stored.');
  }
  if (!isEmailVerified(sessionUser)) {
    throw new Error('Verify your email before continuing.');
  }

  const twinName = store.pendingSignupName || store.name || 'My Twin';
  const profile = {
    twin_name: twinName,
    owner_reference_name: normalizeOwnerReferenceName(store.ownerReferenceName) || null,
    onboarding_mode: store.onboardingMode,
    onboarding_answers: store.onboardingAnswers,
    onboarding_character_profile: store.characterProfile || null,
    onboarding_updated_at: new Date().toISOString(),
  };

  if (store.photoBlob) {
    profile.onboarding_photo_path = await uploadOnboardingBlob(
      ONBOARDING_PHOTO_BUCKET,
      buildOnboardingStoragePath('photo', store.photoBlob.type || 'image/jpeg'),
      store.photoBlob,
    );
  }

  if (store.audioBlob) {
    profile.onboarding_audio_path = await uploadOnboardingBlob(
      ONBOARDING_AUDIO_BUCKET,
      buildOnboardingStoragePath('audio', store.audioBlob.type || 'audio/webm'),
      store.audioBlob,
    );
  }

  await saveOnboardingProfile(profile);
}

export async function markOnboardingPaid(planId) {
  await saveOnboardingProfile({
    selected_plan: planId,
    onboarding_paid_at: new Date().toISOString(),
  });
}

export async function createPricingCheckoutSession(planId) {
  if (!planId) throw new Error('No plan selected.');

  const checkout = await localApiFetch('/api/stripe-checkout', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      customer_email: store.user?.email || store.pendingSignupEmail || '',
      agent_id: store.agentId || '',
      user_id: store.user?.id || '',
    }),
  });

  if (checkout?.session_id) {
    localStorage.setItem(PENDING_PRICING_SESSION_STORAGE_KEY, checkout.session_id);
  }

  return checkout;
}

export async function getPricingCheckoutSession(sessionId) {
  if (!sessionId) throw new Error('Missing Stripe checkout session.');
  return localApiFetch(`/api/stripe-checkout?session_id=${encodeURIComponent(sessionId)}`);
}

export function isCompletedPricingCheckoutSession(session) {
  return session?.status === 'complete'
    && (session?.payment_status === 'paid' || session?.payment_status === 'no_payment_required');
}

export function getPendingPricingCheckoutSessionId() {
  return localStorage.getItem(PENDING_PRICING_SESSION_STORAGE_KEY);
}

export function clearPendingPricingCheckoutSessionId() {
  localStorage.removeItem(PENDING_PRICING_SESSION_STORAGE_KEY);
}

// ── Checkout, Deposits & Balances ──

export async function createCheckout(amountUsd, { chain = 'solana', embedded = false } = {}) {
  if (!store.agentId) return {};
  return agentsApiFetch('/api/agents/supabase-checkout', {
    method: 'POST',
    body: JSON.stringify({
      supabase_agent_id: store.agentId,
      amount_usd: amountUsd,
      chain,
      return_url: window.location.origin,
      embedded,
    }),
  });
}

export async function getWalletBalances() {
  if (!store.agentId) return null;
  return agentsApiFetch(
    `/api/agents/supabase-deposit?supabase_agent_id=${encodeURIComponent(store.agentId)}`,
  );
}

// ── Withdrawals ──

export async function withdrawFunds(amountUsd, chain = 'solana') {
  if (!store.agentId) throw new Error('No agent');
  return agentsApiFetch('/api/agents/supabase-withdraw', {
    method: 'POST',
    body: JSON.stringify({
      supabase_agent_id: store.agentId,
      amount_usd: String(amountUsd),
      chain,
    }),
  });
}

export async function getWithdrawalHistory() {
  if (!store.agentId) return { withdrawals: [] };
  return agentsApiFetch(
    `/api/agents/supabase-withdraw?supabase_agent_id=${encodeURIComponent(store.agentId)}`,
  );
}

// ── Domains ──

export async function searchDomains(keyword) {
  if (!store.agentId) throw new Error('No agent');
  return agentsApiFetch(
    `/api/agents/supabase-domains?supabase_agent_id=${encodeURIComponent(store.agentId)}&action=search&keyword=${encodeURIComponent(keyword)}`,
  );
}

export async function registerDomain(domain) {
  if (!store.agentId) throw new Error('No agent');
  return agentsApiFetch('/api/agents/supabase-domains', {
    method: 'POST',
    body: JSON.stringify({
      supabase_agent_id: store.agentId,
      action: 'register',
      domain,
    }),
  });
}

export async function getDnsRecords(domain) {
  if (!store.agentId) throw new Error('No agent');
  return agentsApiFetch(
    `/api/agents/supabase-domains?supabase_agent_id=${encodeURIComponent(store.agentId)}&action=dns&domain=${encodeURIComponent(domain)}`,
  );
}

export async function addDnsRecord(domain, recordType, content, name, ttl = 600) {
  if (!store.agentId) throw new Error('No agent');
  return agentsApiFetch('/api/agents/supabase-domains', {
    method: 'POST',
    body: JSON.stringify({
      supabase_agent_id: store.agentId,
      action: 'add_dns',
      domain,
      record_type: recordType,
      content,
      name,
      ttl,
    }),
  });
}

export async function deleteDnsRecord(domain, recordId) {
  if (!store.agentId) throw new Error('No agent');
  return agentsApiFetch('/api/agents/supabase-domains', {
    method: 'POST',
    body: JSON.stringify({
      supabase_agent_id: store.agentId,
      action: 'delete_dns',
      domain,
      record_id: recordId,
    }),
  });
}

// ── Soul Generation ──

export async function generateSoul(transcript) {
  if (!store.agentId) throw new Error('No agent');
  const body = { supabase_agent_id: store.agentId };
  if (transcript) body.voice_transcript = transcript;
  const data = await agentsApiFetch('/api/agents/generate-soul', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  // Backend saves personality to Supabase — update local store
  if (data.personality) {
    store.characterProfile = data.personality;
  }
  return data;
}

// ── Voice Clone & TTS ──

export async function cloneVoice() {
  if (!store.agentId) throw new Error('No agent');
  return agentsApiFetch('/api/agents/clone-voice', {
    method: 'POST',
    body: JSON.stringify({ supabase_agent_id: store.agentId }),
  });
}

export async function speakText(text) {
  if (!store.agentId) throw new Error('No agent');
  const data = await agentsApiFetch('/api/agents/speak', {
    method: 'POST',
    body: JSON.stringify({
      supabase_agent_id: store.agentId,
      text,
    }),
  });
  return data;
}

export async function loadOnboardingPhoto() {
  if (!store.user) return null;
  const { data: files, error: listError } = await supabase.storage
    .from(ONBOARDING_PHOTO_BUCKET)
    .list(store.user.id, { limit: 1 });
  if (listError || !files || files.length === 0) return null;

  const { data: blob, error: dlError } = await supabase.storage
    .from(ONBOARDING_PHOTO_BUCKET)
    .download(`${store.user.id}/${files[0].name}`);
  if (dlError) return null;

  store.photoBlob = blob;
  return blob;
}

export async function loadVoiceRef() {
  // Already cached — no-op
  if (store.voiceRefAudioBlob && store.voiceTranscript) return;

  // Load transcript from profile
  if (!store.voiceTranscript) {
    const profile = await getProfile();
    if (profile?.voice_transcript) {
      store.voiceTranscript = profile.voice_transcript;
    }
  }

  // Load audio blob from onboarding-audio bucket
  if (!store.voiceRefAudioBlob) {
    const { data: files, error: listError } = await supabase.storage
      .from(ONBOARDING_AUDIO_BUCKET)
      .list(store.user.id, { limit: 1 });
    if (listError) throw new Error(listError.message);

    if (files && files.length > 0) {
      const { data: blob, error: dlError } = await supabase.storage
        .from(ONBOARDING_AUDIO_BUCKET)
        .download(`${store.user.id}/${files[0].name}`);
      if (dlError) throw new Error(dlError.message);
      store.voiceRefAudioBlob = blob;
    }
  }
}

export async function uploadVoiceMemo(agentId, audioBlob, messageId) {
  const path = `${store.user.id}/${agentId}/${Date.now()}.wav`;
  const { error } = await supabase.storage
    .from(VOICE_MEMOS_BUCKET)
    .upload(path, audioBlob, { contentType: 'audio/wav', upsert: false });
  if (error) throw new Error(error.message);

  // Link voice memo to chat message
  if (messageId) {
    await supabase
      .from('chat_messages')
      .update({ voice_memo_path: path })
      .eq('id', messageId);
  }

  return path;
}

export async function getVoiceMemoUrl(path) {
  if (!path) return null;
  const { data: signed, error } = await supabase.storage
    .from(VOICE_MEMOS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return signed?.signedUrl || null;
}

// ── Brain Control ──

export async function startAgent() {
  if (!store.agentId) throw new Error('No agent');
  const data = await agentsApiFetch('/api/agents/supabase-start', {
    method: 'POST',
    body: JSON.stringify({ supabase_agent_id: store.agentId }),
  });
  store.agentState = data.state || 'running';
  return data;
}

export async function stopAgent() {
  if (!store.agentId) throw new Error('No agent');
  const data = await agentsApiFetch('/api/agents/supabase-stop', {
    method: 'POST',
    body: JSON.stringify({ supabase_agent_id: store.agentId }),
  });
  store.agentState = data.state || 'sleeping';
  return data;
}

// ── Discovery ──

export async function getAgentById(agentId) {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, description, personality, profile_image_url, solana_address, evm_address, agent_state, rocks, last_active, erc8004_agent_id, sati_agent_id')
    .eq('id', agentId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function searchAgents(query) {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, description, personality, profile_image_url, solana_address, evm_address, agent_state, rocks, last_active, erc8004_agent_id, sati_agent_id')
    .ilike('name', `%${query}%`)
    .order('last_active', { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getAllAgents() {
  const { data, error } = await supabase
    .from('agents')
    .select('id, name, description, personality, profile_image_url, solana_address, evm_address, agent_state, rocks, last_active, erc8004_agent_id, sati_agent_id')
    .order('last_active', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getRegistry() {
  return agentsApiFetch('/api/registry');
}

export async function getActivity() {
  return agentsApiFetch('/api/activity');
}

export async function getAgentMessages() {
  return agentsApiFetch('/api/messages');
}

// ── Tools & Marketplace ──

export async function getTools() {
  const data = await agentsApiFetch('/api/tools');
  store.agentTools = Array.isArray(data) ? data : [];
  return store.agentTools;
}

export async function getListings() {
  return agentsApiFetch('/api/listings');
}

export async function getTrades() {
  return agentsApiFetch('/api/trades');
}

function buildOnboardingStoragePath(kind, mimeType) {
  const ext = extensionForMime(mimeType, kind === 'audio' ? 'webm' : 'jpg');
  return `${store.user.id}/${kind}.${ext}`;
}

function extensionForMime(mimeType, fallback) {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  return fallback;
}

async function uploadOnboardingBlob(bucket, path, blob) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });

  if (error) throw new Error(error.message);
  return path;
}

function normalizeOwnerReferenceName(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function getOwnerReferenceFallbackName(...values) {
  for (const value of values) {
    const normalized = normalizeOwnerReferenceName(value);
    if (!normalized || normalized === 'CyberTwin User') continue;
    return normalized;
  }
  return '';
}
