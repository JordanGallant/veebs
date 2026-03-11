import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { getAllAgents, searchAgents, getAgentMessages, getTrades, sendMessage } from '../lib/api.js';

export function createDiscover(parent) {
  const wrapper = el('div', { class: 'discover-panel' });

  // ── Search by username ──
  const searchSection = el('div', { class: 'discover-search' });
  const searchInput = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'Search by username...',
  });
  const searchBtn = el('button', { class: 'btn', type: 'button' }, 'Find');
  const searchRow = el('div', { class: 'discover-search-row' }, searchInput, searchBtn);
  const searchResults = el('div', { class: 'discover-section-body' });
  searchSection.append(searchRow, searchResults);

  async function doSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    clear(searchResults);
    searchResults.appendChild(el('p', { class: 'discover-empty' }, 'Searching...'));

    try {
      const agents = await searchAgents(query);
      clear(searchResults);
      if (agents.length === 0) {
        searchResults.appendChild(el('p', { class: 'discover-empty' }, 'No agents found.'));
        return;
      }
      for (const agent of agents) {
        searchResults.appendChild(renderAgentCard(agent));
      }
    } catch {
      clear(searchResults);
      searchResults.appendChild(el('p', { class: 'discover-empty' }, 'Could not find agent.'));
    }
  }

  on(searchBtn, 'click', doSearch);
  on(searchInput, 'keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  // ── Agent Directory ──
  const directoryFold = el('details', { class: 'discover-section', open: '' });
  const directorySummary = el('summary', null, 'Agent Directory');
  const directoryBody = el('div', { class: 'discover-section-body' });
  directoryFold.append(directorySummary, directoryBody);

  // ── Token Launches & Trades ──
  const tradesFold = el('details', { class: 'discover-section' });
  const tradesSummary = el('summary', null, 'Token Trades');
  const tradesBody = el('div', { class: 'discover-section-body' });
  tradesFold.append(tradesSummary, tradesBody);

  // ── My Agent's Messages ──
  const messagesFold = el('details', { class: 'discover-section' });
  const messagesSummary = el('summary', null, 'My Agent Messages');
  const messagesBody = el('div', { class: 'discover-section-body' });
  messagesFold.append(messagesSummary, messagesBody);

  wrapper.append(searchSection, directoryFold, tradesFold, messagesFold);
  parent.appendChild(wrapper);

  loadDirectory(directoryBody);
  loadTrades(tradesBody);
  loadMyMessages(messagesBody);
}

async function loadDirectory(container) {
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const agents = await getAllAgents();
    clear(container);
    if (!Array.isArray(agents) || agents.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No agents discovered yet.'));
      return;
    }
    const others = agents.filter((a) => a.id !== store.agentId);
    if (others.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No other agents yet.'));
      return;
    }
    for (const agent of others) {
      container.appendChild(renderAgentCard(agent));
    }
  } catch {
    clear(container);
    container.appendChild(el('p', { class: 'discover-empty' }, 'Could not load agents.'));
  }
}

function renderAgentCard(agent) {
  const statusClass = `agent-status-dot agent-status-dot--${agent.agent_state || 'sleeping'}`;
  const username = agent.name || 'Unnamed';
  const nameLine = el('div', { class: 'discover-agent-card-name' },
    el('span', { class: statusClass }),
    `@${username}`,
  );

  const meta = [];
  if (agent.rocks > 0) meta.push(`${agent.rocks} rocks`);
  if (agent.last_active) meta.push(formatRelativeTime(agent.last_active));
  const metaLine = meta.length > 0
    ? el('p', { class: 'discover-agent-card-meta secondary text-xs' }, meta.join(' · '))
    : null;

  const desc = el('p', { class: 'discover-agent-card-desc' },
    agent.description || agent.personality || '',
  );

  const info = el('div', { class: 'discover-agent-card-info' }, nameLine);
  if (metaLine) info.appendChild(metaLine);
  info.appendChild(desc);

  // Token badges
  const hasToken = agent.erc8004_agent_id || agent.sati_agent_id;
  if (hasToken) {
    const tokenBadges = el('div', { class: 'discover-token-badges' });
    if (agent.erc8004_agent_id) {
      tokenBadges.appendChild(el('span', { class: 'token-badge token-badge--erc' }, `ERC-8004 #${agent.erc8004_agent_id}`));
    }
    if (agent.sati_agent_id) {
      tokenBadges.appendChild(el('span', { class: 'token-badge token-badge--sati' }, 'SATI'));
    }
    info.appendChild(tokenBadges);
  }

  // On-chain chips
  const chips = el('div', { class: 'discover-agent-card-caps' });
  if (agent.solana_address) {
    const short = agent.solana_address.slice(0, 6) + '...' + agent.solana_address.slice(-4);
    chips.appendChild(el('a', {
      class: 'tool-badge',
      href: `https://explorer.solana.com/address/${agent.solana_address}?cluster=devnet`,
      target: '_blank', rel: 'noopener',
    }, `SOL ${short}`));
  }
  if (agent.evm_address) {
    const short = agent.evm_address.slice(0, 6) + '...' + agent.evm_address.slice(-4);
    chips.appendChild(el('a', {
      class: 'tool-badge',
      href: `https://sepolia.basescan.org/address/${agent.evm_address}`,
      target: '_blank', rel: 'noopener',
    }, `EVM ${short}`));
  }
  if (chips.children.length > 0) info.appendChild(chips);

  // Connect button
  const connectStatus = el('p', { class: 'secondary text-xs' });
  const connectBtn = el('button', { class: 'btn btn--secondary discover-connect-btn', type: 'button' }, 'Connect');

  on(connectBtn, 'click', async () => {
    if (!store.agentId) {
      connectStatus.textContent = 'Create your twin first.';
      return;
    }
    connectBtn.setAttribute('disabled', '');
    connectBtn.textContent = 'Connecting...';
    connectStatus.textContent = '';

    const msg = `Connect with agent @${username} and introduce yourself`;

    try {
      await sendMessage(msg);
      connectBtn.textContent = 'Sent';
      connectStatus.textContent = `Your agent is reaching out to @${username}.`;
    } catch (err) {
      connectBtn.removeAttribute('disabled');
      connectBtn.textContent = 'Connect';
      connectStatus.textContent = err.message;
    }
  });

  const actions = el('div', { class: 'discover-agent-card-actions' }, connectBtn, connectStatus);
  const card = el('div', { class: 'discover-agent-card' }, info, actions);

  // Tap card to expand profile + token details
  let expanded = false;
  const profileDetail = el('div', { class: 'discover-agent-profile' });
  profileDetail.style.display = 'none';

  on(card, 'click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    expanded = !expanded;
    profileDetail.style.display = expanded ? 'block' : 'none';
    card.classList.toggle('discover-agent-card--expanded', expanded);
    if (expanded && profileDetail.children.length === 0) {
      renderAgentProfile(profileDetail, agent);
    }
  });

  card.appendChild(profileDetail);
  return card;
}

function renderAgentProfile(container, agent) {
  if (agent.personality) {
    container.appendChild(el('p', { class: 'text-sm', style: 'white-space:pre-wrap' }, agent.personality));
  }

  // Token details section
  if (agent.erc8004_agent_id || agent.sati_agent_id) {
    const tokenSection = el('div', { class: 'discover-token-details' });
    tokenSection.appendChild(el('p', { class: 'text-sm bold' }, 'Tokens'));

    if (agent.erc8004_agent_id) {
      const ercRow = el('div', { class: 'discover-token-row' });
      ercRow.appendChild(el('span', { class: 'token-badge token-badge--erc' }, 'ERC-8004'));
      ercRow.appendChild(el('span', { class: 'secondary text-xs' }, `Token #${agent.erc8004_agent_id}`));
      if (agent.evm_address) {
        ercRow.appendChild(el('a', {
          class: 'tool-badge',
          href: `https://sepolia.basescan.org/address/${agent.evm_address}`,
          target: '_blank', rel: 'noopener',
        }, 'View on Basescan'));
      }
      tokenSection.appendChild(ercRow);
    }

    if (agent.sati_agent_id) {
      const satiRow = el('div', { class: 'discover-token-row' });
      satiRow.appendChild(el('span', { class: 'token-badge token-badge--sati' }, 'SATI'));
      const satiId = agent.sati_agent_id;
      const satiShort = satiId.length > 20 ? satiId.slice(0, 8) + '...' + satiId.slice(-6) : satiId;
      satiRow.appendChild(el('span', { class: 'secondary text-xs' }, satiShort));
      if (agent.solana_address) {
        satiRow.appendChild(el('a', {
          class: 'tool-badge',
          href: `https://explorer.solana.com/address/${agent.solana_address}?cluster=devnet`,
          target: '_blank', rel: 'noopener',
        }, 'View on Solscan'));
      }
      tokenSection.appendChild(satiRow);
    }

    container.appendChild(tokenSection);
  } else {
    container.appendChild(el('p', { class: 'secondary text-xs' }, 'No tokens launched yet. Agents can tokenize via chat.'));
  }

  // Wallet addresses
  if (agent.solana_address) {
    container.appendChild(el('p', { class: 'secondary text-xs', style: 'word-break:break-all' },
      `Solana: ${agent.solana_address}`));
  }
  if (agent.evm_address) {
    container.appendChild(el('p', { class: 'secondary text-xs', style: 'word-break:break-all' },
      `EVM: ${agent.evm_address}`));
  }
}

// ── Token Trades ──

async function loadTrades(container) {
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const trades = await getTrades();
    clear(container);

    const list = Array.isArray(trades) ? trades : (trades?.trades || trades?.data || []);
    if (list.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No token trades yet.'));
      return;
    }

    for (const trade of list.slice(0, 50)) {
      container.appendChild(renderTradeItem(trade));
    }
  } catch {
    clear(container);
    container.appendChild(el('p', { class: 'discover-empty' }, 'Could not load trades.'));
  }
}

function renderTradeItem(trade) {
  const time = trade.created_at || trade.timestamp ? formatRelativeTime(trade.created_at || trade.timestamp) : '';
  const type = trade.type || trade.action || 'trade';
  const chain = trade.chain || '';
  const amount = trade.amount != null ? `$${Number(trade.amount).toFixed(2)}` : '';
  const token = trade.token_name || trade.token_symbol || trade.token || '';
  const from = trade.from_name || trade.from_agent || '';
  const to = trade.to_name || trade.to_agent || '';

  const typeBadge = el('span', {
    class: `trade-type-badge trade-type-badge--${type}`,
  }, type);

  const details = [];
  if (token) details.push(token);
  if (amount) details.push(amount);
  if (chain) details.push(chain);
  const detailText = details.join(' · ');

  const parties = [];
  if (from) parties.push(from);
  if (to) parties.push(`→ ${to}`);
  const partyText = parties.join(' ');

  const row = el('div', { class: 'trade-item' },
    typeBadge,
    el('div', { class: 'trade-item-info' },
      el('span', { class: 'text-sm' }, detailText || 'Transaction'),
      partyText ? el('span', { class: 'secondary text-xs' }, partyText) : null,
    ),
    el('span', { class: 'secondary text-xs' }, time),
  );

  // Link to explorer if tx hash present
  const txHash = trade.tx_hash || trade.transaction_hash;
  if (txHash && chain) {
    const explorerUrl = chain.includes('solana')
      ? `https://explorer.solana.com/tx/${txHash}?cluster=devnet`
      : `https://sepolia.basescan.org/tx/${txHash}`;
    const link = el('a', {
      class: 'tool-badge',
      href: explorerUrl,
      target: '_blank', rel: 'noopener',
      style: 'margin-left:auto;flex-shrink:0;',
    }, 'Tx');
    row.appendChild(link);
  }

  return row;
}

// ── My Messages ──

async function loadMyMessages(container) {
  const myId = store.localAgentId;
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const messages = await getAgentMessages();
    clear(container);
    if (!Array.isArray(messages) || messages.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No messages yet.'));
      return;
    }

    const mine = myId
      ? messages.filter((m) => m.from_id === myId || m.to_id === myId)
      : [];

    if (mine.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No messages for your agent yet.'));
      return;
    }

    for (const msg of mine.slice(0, 50)) {
      const time = msg.created_at ? formatRelativeTime(msg.created_at) : '';
      const direction = msg.from_id === myId ? `→ ${msg.to_name || 'agent'}` : `← ${msg.from_name || 'agent'}`;
      const header = el('div', { class: 'agent-message-header' },
        el('span', null, direction),
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
