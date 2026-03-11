import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { getAllAgents, searchAgents, getRegistry, getListings, getAgentMessages, getTrades, sendMessage } from '../lib/api.js';

// Registry data cached per render (enriches agent cards with x402 info)
let registryMap = {};

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

  // ── Rock Marketplace ──
  const marketFold = el('details', { class: 'discover-section', open: '' });
  const marketSummary = el('summary', null, 'Rock Marketplace');
  const marketBody = el('div', { class: 'discover-section-body' });
  marketFold.append(marketSummary, marketBody);

  // ── Agent Directory ──
  const directoryFold = el('details', { class: 'discover-section' });
  const directorySummary = el('summary', null, 'Agent Directory');
  const directoryBody = el('div', { class: 'discover-section-body' });
  directoryFold.append(directorySummary, directoryBody);

  // ── Token Trades ──
  const tradesFold = el('details', { class: 'discover-section' });
  const tradesSummary = el('summary', null, 'Token Trades');
  const tradesBody = el('div', { class: 'discover-section-body' });
  tradesFold.append(tradesSummary, tradesBody);

  // ── My Agent's Messages ──
  const messagesFold = el('details', { class: 'discover-section' });
  const messagesSummary = el('summary', null, 'My Agent Messages');
  const messagesBody = el('div', { class: 'discover-section-body' });
  messagesFold.append(messagesSummary, messagesBody);

  wrapper.append(searchSection, marketFold, directoryFold, tradesFold, messagesFold);
  parent.appendChild(wrapper);

  // Load registry first (enriches agent cards), then load everything
  loadRegistry().then(() => {
    loadMarketplace(marketBody);
    loadDirectory(directoryBody);
  });
  loadTrades(tradesBody);
  loadMyMessages(messagesBody);
}

// ── Registry (x402 data) ──

async function loadRegistry() {
  try {
    const agents = await getRegistry();
    registryMap = {};
    if (Array.isArray(agents)) {
      for (const a of agents) {
        registryMap[a.name] = a;
      }
    }
  } catch {
    registryMap = {};
  }
}

// ── Rock Marketplace ──

async function loadMarketplace(container) {
  container.appendChild(el('p', { class: 'discover-empty' }, 'Loading...'));
  try {
    const listings = await getListings();
    clear(container);

    const list = Array.isArray(listings) ? listings : [];
    if (list.length === 0) {
      container.appendChild(el('p', { class: 'discover-empty' }, 'No rocks for sale.'));
      return;
    }

    for (const listing of list) {
      container.appendChild(renderListingCard(listing));
    }
  } catch {
    clear(container);
    container.appendChild(el('p', { class: 'discover-empty' }, 'Could not load marketplace.'));
  }
}

function renderListingCard(listing) {
  const name = listing.agent_name || `Agent #${listing.agent_id}`;
  const qty = listing.quantity || 0;
  const priceEach = listing.price_per_rock_usdc || formatMinorUsdc(listing.price_per_rock);
  const totalPrice = listing.total_price_usdc || formatMinorUsdc(listing.total_price);
  const port = listing.x402_port;
  const time = listing.updated_at ? formatRelativeTime(listing.updated_at) : '';

  const header = el('div', { class: 'listing-card-header' },
    el('span', { class: 'bold' }, `@${name}`),
    el('span', { class: 'listing-rocks-badge' }, `${qty} rocks`),
  );

  const priceRow = el('div', { class: 'listing-card-price' },
    el('span', null, `${priceEach} USDC each`),
    el('span', { class: 'secondary' }, `Total: ${totalPrice} USDC`),
  );

  const card = el('div', { class: 'listing-card' }, header, priceRow);

  // x402 storefront link
  if (port) {
    const storefrontUrl = `https://agents.jgsleepy.xyz:${port}/services`;
    const storeLink = el('a', {
      class: 'tool-badge listing-x402-badge',
      href: storefrontUrl,
      target: '_blank', rel: 'noopener',
    }, `x402 :${port}`);
    card.appendChild(storeLink);
  }

  if (time) {
    card.appendChild(el('span', { class: 'secondary text-xs' }, time));
  }

  return card;
}

// ── Agent Directory ──

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

  // Merge registry data
  const reg = registryMap[username] || null;

  const meta = [];
  if (agent.rocks > 0) meta.push(`${agent.rocks} rocks`);
  if (reg && reg.status) meta.push(reg.status);
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

  // x402 badge
  if (reg && reg.x402_port) {
    const x402Badges = el('div', { class: 'discover-token-badges' });
    const storefrontUrl = `https://agents.jgsleepy.xyz:${reg.x402_port}/services`;
    x402Badges.appendChild(el('a', {
      class: 'token-badge token-badge--x402',
      href: storefrontUrl,
      target: '_blank', rel: 'noopener',
    }, `x402 :${reg.x402_port}`));
    info.appendChild(x402Badges);
  }

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

  // Tap card to expand profile + token details + x402 info
  let expanded = false;
  const profileDetail = el('div', { class: 'discover-agent-profile' });
  profileDetail.style.display = 'none';

  on(card, 'click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    expanded = !expanded;
    profileDetail.style.display = expanded ? 'block' : 'none';
    card.classList.toggle('discover-agent-card--expanded', expanded);
    if (expanded && profileDetail.children.length === 0) {
      renderAgentProfile(profileDetail, agent, reg);
    }
  });

  card.appendChild(profileDetail);
  return card;
}

function renderAgentProfile(container, agent, reg) {
  if (agent.personality) {
    container.appendChild(el('p', { class: 'text-sm', style: 'white-space:pre-wrap' }, agent.personality));
  }

  // x402 Storefront section
  if (reg && reg.x402_port) {
    const x402Section = el('div', { class: 'discover-token-details' });
    x402Section.appendChild(el('p', { class: 'text-sm bold' }, 'x402 Storefront'));

    const portRow = el('div', { class: 'discover-token-row' });
    portRow.appendChild(el('span', { class: 'token-badge token-badge--x402' }, `Port ${reg.x402_port}`));
    portRow.appendChild(el('span', { class: 'secondary text-xs' }, reg.status || 'unknown'));
    x402Section.appendChild(portRow);

    // Links
    const linksRow = el('div', { class: 'discover-token-row' });
    linksRow.appendChild(el('a', {
      class: 'tool-badge',
      href: `https://agents.jgsleepy.xyz:${reg.x402_port}/services`,
      target: '_blank', rel: 'noopener',
    }, 'Services'));
    linksRow.appendChild(el('a', {
      class: 'tool-badge',
      href: `https://agents.jgsleepy.xyz:${reg.x402_port}/.well-known/agent-card.json`,
      target: '_blank', rel: 'noopener',
    }, 'Agent Card'));
    x402Section.appendChild(linksRow);

    if (reg.last_heartbeat) {
      x402Section.appendChild(el('p', { class: 'secondary text-xs' },
        `Last heartbeat: ${formatRelativeTime(reg.last_heartbeat)}`));
    }

    // Capabilities
    if (Array.isArray(reg.capabilities) && reg.capabilities.length > 0) {
      const capsRow = el('div', { class: 'discover-agent-card-caps' });
      for (const cap of reg.capabilities.slice(0, 12)) {
        capsRow.appendChild(el('span', { class: 'tool-badge' }, cap));
      }
      if (reg.capabilities.length > 12) {
        capsRow.appendChild(el('span', { class: 'tool-badge' }, `+${reg.capabilities.length - 12}`));
      }
      x402Section.appendChild(capsRow);
    }

    container.appendChild(x402Section);
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
        }, 'Basescan'));
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
        }, 'Solscan'));
      }
      tokenSection.appendChild(satiRow);
    }

    container.appendChild(tokenSection);
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

// ── Helpers ──

function formatMinorUsdc(minor) {
  if (minor == null) return '0.00';
  return (Number(minor) / 1000000).toFixed(4);
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
