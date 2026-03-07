/**
 * API client for agents-demo backend.
 * Handles auth (register/login), chat, and Stripe checkout.
 */

import { store } from './store.js';

// Change this to your deployed agents-demo URL when ready
const API_BASE = 'https://agents.jgsleepy.xyz';

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (store.token) {
    headers['Authorization'] = `Bearer ${store.token}`;
  }
  return headers;
}

// ── Auth ──

export async function register(email, password, displayName) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Registration failed (${res.status})`);
  store.token = data.token;
  store.user = data.user;
  localStorage.setItem('ct_token', data.token);
  localStorage.setItem('ct_user', JSON.stringify(data.user));
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
  store.token = data.token;
  store.user = data.user;
  localStorage.setItem('ct_token', data.token);
  localStorage.setItem('ct_user', JSON.stringify(data.user));
  return data;
}

export function logout() {
  store.token = null;
  store.user = null;
  store.agentId = 1;
  localStorage.removeItem('ct_token');
  localStorage.removeItem('ct_user');
  localStorage.removeItem('ct_agent_id');
  localStorage.removeItem('ct_agent');
}

export function restoreSession() {
  const token = localStorage.getItem('ct_token');
  const user = localStorage.getItem('ct_user');
  if (token && user) {
    store.token = token;
    try { store.user = JSON.parse(user); } catch { store.user = null; }
    const agentId = localStorage.getItem('ct_agent_id');
    if (agentId) store.agentId = parseInt(agentId, 10);
    const agentJson = localStorage.getItem('ct_agent');
    if (agentJson) {
      try {
        const agent = JSON.parse(agentJson);
        if (agent.name) store.name = agent.name;
      } catch {}
    }
    return true;
  }
  return false;
}

// ── Chat ──

export async function sendMessage(message) {
  const agentId = store.agentId;
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Chat failed (${res.status})`);
  return data;
}

export async function getChatHistory() {
  const agentId = store.agentId;
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/chat`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to load history (${res.status})`);
  return data;
}

// ── Agents ──

export async function createAgent(name, description, personality) {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      description: description || '',
      personality: personality || '',
      rocks: 0,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Agent creation failed (${res.status})`);
  // Set this as the active agent
  store.agentId = data.id;
  localStorage.setItem('ct_agent_id', String(data.id));
  localStorage.setItem('ct_agent', JSON.stringify(data));
  return data;
}

export async function getMyAgents() {
  const res = await fetch(`${API_BASE}/api/agents`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to fetch agents (${res.status})`);
  return data;
}

export async function loadOrCreateAgent(name, characterProfile) {
  // Check if user already has an agent
  try {
    const agents = await getMyAgents();
    if (Array.isArray(agents) && agents.length > 0) {
      const agent = agents[0];
      store.agentId = agent.id;
      localStorage.setItem('ct_agent_id', String(agent.id));
      localStorage.setItem('ct_agent', JSON.stringify(agent));
      return agent;
    }
  } catch {
    // Fall through to create
  }

  // Create a new agent
  return createAgent(name, 'CyberTwin agent', characterProfile || '');
}

// ── Profile Image ──

export async function saveProfileImage(imageUrl) {
  const agentId = store.agentId;
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/profile-image`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ imageUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to save image (${res.status})`);
  return data;
}

export async function getProfileImage() {
  const agentId = store.agentId;
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/profile-image`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to get image (${res.status})`);
  return data.imageUrl;
}

// ── Stripe Checkout ──

export async function createCheckout(amountUsd, { embedded = false } = {}) {
  const agentId = store.agentId;
  const res = await fetch(`${API_BASE}/api/checkout`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ agentId, amountUsd, chain: 'solana', returnUrl: window.location.origin, embedded }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`);
  return data;
}
