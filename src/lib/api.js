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
  localStorage.removeItem('ct_token');
  localStorage.removeItem('ct_user');
}

export function restoreSession() {
  const token = localStorage.getItem('ct_token');
  const user = localStorage.getItem('ct_user');
  if (token && user) {
    store.token = token;
    try { store.user = JSON.parse(user); } catch { store.user = null; }
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

// ── Stripe Checkout ──

export async function createCheckout(amountUsd) {
  const agentId = store.agentId;
  const res = await fetch(`${API_BASE}/api/checkout`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ agentId, amountUsd, chain: 'solana', returnUrl: window.location.origin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`);
  return data;
}
