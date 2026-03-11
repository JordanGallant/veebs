import { el, on, clear } from '../lib/dom.js';
import { getRegistry, getActivity, getAgentMessages } from '../lib/api.js';

const ACTIVITY_ICONS = {
  deposit_received: '$',
  human_message: '>',
  agent_reply: '<',
  brain_action: '*',
  trade_completed: '~',
  rocks_transferred: '#',
};

export function createDiscover(parent) {
  const wrapper = el('div', { class: 'discover-panel' });

  // ── Registry ──
  const registryFold = el('details', { class: 'discover-section', open: '' });
  const registrySummary = el('summary', null, 'Agent Registry');
  const registryBody = el('div', { class: 'discover-section-body' });
  registryFold.append(registrySummary, registryBody);

  // ── Activity ──
  const activityFold = el('details', { class: 'discover-section' });
  const activitySummary = el('summary', null, 'Activity Feed');
  const activityBody = el('div', { class: 'discover-section-body' });
  activityFold.append(activitySummary, activityBody);

  // ── Messages ──
  const messagesFold = el('details', { class: 'discover-section' });
  const messagesSummary = el('summary', null, 'Agent Messages');
  const messagesBody = el('div', { class: 'discover-section-body' });
  messagesFold.append(messagesSummary, messagesBody);

  wrapper.append(registryFold, activityFold, messagesFold);
  parent.appendChild(wrapper);

  // Load data
  loadRegistry(registryBody);
  loadActivity(activityBody);
  loadMessages(messagesBody);
}

async function loadRegistry(container) {
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const agents = await getRegistry();
    clear(container);
    if (!Array.isArray(agents) || agents.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No agents discovered yet.'));
      return;
    }
    for (const agent of agents) {
      container.appendChild(renderAgentCard(agent));
    }
  } catch {
    clear(container);
    container.appendChild(el('p', { class: 'discover-empty' }, 'Could not load registry.'));
  }
}

function renderAgentCard(agent) {
  const statusClass = `agent-status-dot agent-status-dot--${agent.state || 'sleeping'}`;
  const nameLine = el('div', { class: 'discover-agent-card-name' },
    el('span', { class: statusClass }),
    agent.name || 'Unknown',
  );
  const desc = el('p', { class: 'discover-agent-card-desc' }, agent.description || '');

  const info = el('div', { class: 'discover-agent-card-info' }, nameLine, desc);

  if (Array.isArray(agent.capabilities) && agent.capabilities.length > 0) {
    const caps = el('div', { class: 'discover-agent-card-caps' });
    const shown = agent.capabilities.slice(0, 8);
    for (const cap of shown) {
      caps.appendChild(el('span', { class: 'tool-badge' }, cap));
    }
    if (agent.capabilities.length > 8) {
      caps.appendChild(el('span', { class: 'tool-badge' }, `+${agent.capabilities.length - 8}`));
    }
    info.appendChild(caps);
  }

  return el('div', { class: 'discover-agent-card' }, info);
}

async function loadActivity(container) {
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const items = await getActivity();
    clear(container);
    if (!Array.isArray(items) || items.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No activity yet.'));
      return;
    }
    for (const item of items.slice(0, 50)) {
      const icon = ACTIVITY_ICONS[item.type] || '·';
      const time = item.created_at ? formatRelativeTime(item.created_at) : '';
      container.appendChild(
        el('div', { class: 'activity-item' },
          el('span', { class: 'activity-item-icon' }, icon),
          el('span', null, item.description || ''),
          el('span', { class: 'activity-item-time' }, time),
        ),
      );
    }
  } catch {
    clear(container);
    container.appendChild(el('p', { class: 'discover-empty' }, 'Could not load activity.'));
  }
}

async function loadMessages(container) {
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const messages = await getAgentMessages();
    clear(container);
    if (!Array.isArray(messages) || messages.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No agent messages yet.'));
      return;
    }
    for (const msg of messages.slice(0, 50)) {
      const time = msg.created_at ? formatRelativeTime(msg.created_at) : '';
      const header = el('div', { class: 'agent-message-header' },
        el('span', null, `Agent #${msg.from_id} → Agent #${msg.to_id}`),
        el('span', null, time),
      );
      container.appendChild(
        el('div', { class: 'agent-message-item' }, header, msg.content || ''),
      );
    }
  } catch {
    clear(container);
    container.appendChild(el('p', { class: 'discover-empty' }, 'Could not load messages.'));
  }
}

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}
