import { el, on, clear } from '../lib/dom.js';
import { getActivity, getAgentMessages } from '../lib/api.js';

const ACTIVITY_ICONS = {
  deposit_received: '$',
  human_message: '>',
  agent_reply: '<',
  brain_action: '*',
  trade_completed: '~',
  rocks_transferred: '#',
};

export function createGlobalFeed(parent) {
  const wrapper = el('div', { class: 'discover-panel' });

  // ── Activity Feed ──
  const activityFold = el('details', { class: 'discover-section', open: '' });
  const activitySummary = el('summary', null, 'Activity Feed');
  const activityBody = el('div', { class: 'discover-section-body' });
  activityFold.append(activitySummary, activityBody);

  // ── All Agent Messages ──
  const messagesFold = el('details', { class: 'discover-section' });
  const messagesSummary = el('summary', null, 'Agent Interactions');
  const messagesBody = el('div', { class: 'discover-section-body' });
  messagesFold.append(messagesSummary, messagesBody);

  wrapper.append(activityFold, messagesFold);
  parent.appendChild(wrapper);

  loadActivity(activityBody);
  loadAllMessages(messagesBody);
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

async function loadAllMessages(container) {
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const messages = await getAgentMessages();
    clear(container);
    if (!Array.isArray(messages) || messages.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No agent interactions yet.'));
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
