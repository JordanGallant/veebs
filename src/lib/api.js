/**
 * API client — backed by Supabase for auth, database, and storage.
 */

import { supabase } from './supabase.js';
import { store } from './store.js';

const ONBOARDING_PHOTO_BUCKET = 'onboarding-photos';
const ONBOARDING_AUDIO_BUCKET = 'onboarding-audio';

// ── Auth ──

export async function register(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || 'CyberTwin User' } },
  });
  if (error) throw new Error(error.message);

  if (data.session?.user) {
    store.user = data.session.user;
  } else {
    store.user = null;
  }

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

  store.user = data.user;
  return data;
}

export async function verifySignupCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw new Error(error.message);

  store.user = data.user;
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
  store.user = null;
  store.agentId = null;
}

export async function restoreSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  store.user = session.user;

  try {
    const agents = await getMyAgents();
    if (agents.length > 0) {
      store.agentId = agents[0].id;
      if (agents[0].name) store.name = agents[0].name;
    }
  } catch {
    // Agent will be created later during onboarding
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
      return agents[0];
    }
  } catch {
    // Fall through to create
  }
  return createAgent(name, 'CyberTwin agent', characterProfile || '');
}

// ── Profile Image ──

export async function saveProfileImage(imageUrl) {
  const { error } = await supabase
    .from('agents')
    .update({ profile_image_url: imageUrl })
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
  return data?.profile_image_url;
}

// ── Chat ──

export async function sendMessage(message) {
  const { error: insertErr } = await supabase.from('chat_messages').insert({
    agent_id: store.agentId,
    user_id: store.user.id,
    role: 'user',
    content: message,
  });
  if (insertErr) throw new Error(insertErr.message);

  // TODO: replace with an LLM call (Supabase Edge Function, OpenAI, etc.)
  const reply = "I hear you. LLM integration is not wired up yet — stay tuned.";

  await supabase.from('chat_messages').insert({
    agent_id: store.agentId,
    user_id: store.user.id,
    role: 'assistant',
    content: reply,
  });

  return { response: reply };
}

export async function getChatHistory() {
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

export async function syncOnboardingData() {
  if (!store.user) {
    throw new Error('You must be signed in before onboarding data can be stored.');
  }

  const twinName = store.pendingSignupName || store.name || 'My Twin';
  const profile = {
    twin_name: twinName,
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

// ── Stripe Checkout (stub — needs a backend endpoint / Edge Function) ──

export async function createCheckout(amountUsd, { embedded = false } = {}) {
  // TODO: implement via Supabase Edge Function or external backend
  return {};
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
