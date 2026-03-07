import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { createCheckout } from '../lib/api.js';

// Rocky's Solana address — will be dynamic per-agent later
const AGENT_WALLET = 'AKKohuNbXTRo4hAxsTzMv65njbYA54wspfjDgWj1ifzp';

export function createWallet(parent) {
  const balanceEl = el('div', { class: 'wallet-balance' }, formatCurrency(store.balance));

  // ── QR Code Section ──
  const qrHeading = el('p', { class: 'text-sm bold' }, 'Agent Wallet');
  const walletAddr = el('p', {
    class: 'secondary text-xs wallet-address',
    title: 'Click to copy',
    style: 'cursor:pointer;word-break:break-all;',
  }, AGENT_WALLET);

  const qrImg = el('img', {
    class: 'wallet-qr',
    src: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=solana:${AGENT_WALLET}`,
    alt: 'Agent wallet QR code',
    width: '180',
    height: '180',
    style: 'display:block;margin:var(--space-sm) auto;image-rendering:pixelated;',
  });

  const copyStatus = el('p', { class: 'secondary text-xs', style: 'text-align:center' });

  on(walletAddr, 'click', async () => {
    try {
      await navigator.clipboard.writeText(AGENT_WALLET);
      copyStatus.textContent = 'Copied!';
      setTimeout(() => { copyStatus.textContent = ''; }, 1500);
    } catch {
      copyStatus.textContent = 'Copy failed';
    }
  });

  const qrSection = el('div', { class: 'wallet-qr-section' },
    qrHeading, qrImg, walletAddr, copyStatus);

  // ── Spending Limit ──
  const limitLabel = el('label', { for: 'monthly-limit', class: 'text-sm' }, 'Monthly Spending Limit');
  const limitInput = el('input', {
    class: 'input',
    type: 'number',
    id: 'monthly-limit',
    min: '0',
    step: '0.01',
    placeholder: 'Not set',
  });
  if (store.monthlySpendingLimit != null) {
    limitInput.value = store.monthlySpendingLimit.toFixed(2);
  }
  const limitBtn = el('button', { class: 'btn btn--secondary', type: 'button' }, 'Save Limit');
  const limitStatus = el('p', { class: 'secondary text-sm' });

  function renderLimit() {
    if (store.monthlySpendingLimit == null) {
      limitStatus.textContent = 'Monthly spending limit is not set.';
      return;
    }
    limitStatus.textContent = `Monthly spending limit: ${formatCurrency(store.monthlySpendingLimit)}`;
  }

  on(limitBtn, 'click', () => {
    const raw = limitInput.value.trim();
    if (!raw) {
      store.monthlySpendingLimit = null;
      renderLimit();
      return;
    }
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) return;
    store.monthlySpendingLimit = val;
    renderLimit();
  });

  const limitForm = el(
    'div',
    { class: 'deposit-form' },
    el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:var(--space-xs)' }, limitLabel, limitInput),
    limitBtn,
  );

  // ── Deposit via Stripe ──
  const amountLabel = el('label', { for: 'deposit-amount', class: 'text-sm' }, 'Deposit Amount (EUR)');
  const amountInput = el('input', {
    class: 'input',
    type: 'number',
    id: 'deposit-amount',
    min: '1',
    step: '1',
    placeholder: '10',
  });
  const depositBtn = el('button', { class: 'btn' }, 'Deposit via iDEAL');
  const depositStatus = el('p', { class: 'secondary text-sm' });

  on(depositBtn, 'click', async () => {
    const val = parseFloat(amountInput.value);
    if (isNaN(val) || val <= 0) {
      depositStatus.textContent = 'Enter an amount.';
      return;
    }

    depositBtn.setAttribute('disabled', '');
    depositBtn.textContent = 'Redirecting...';
    depositStatus.textContent = '';

    try {
      const checkout = await createCheckout(val);
      if (checkout.checkout_url) {
        window.location.href = checkout.checkout_url;
      } else {
        // Stripe not configured — mock deposit
        store.balance += val;
        store.transactions.push({
          amount: val,
          type: 'deposit',
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        });
        balanceEl.textContent = formatCurrency(store.balance);
        amountInput.value = '';
        renderTx();
        depositBtn.removeAttribute('disabled');
        depositBtn.textContent = 'Deposit via iDEAL';
      }
    } catch (err) {
      depositStatus.textContent = err.message;
      depositBtn.removeAttribute('disabled');
      depositBtn.textContent = 'Deposit via iDEAL';
    }
  });

  const form = el('div', { class: 'deposit-form' },
    el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:var(--space-xs)' }, amountLabel, amountInput),
    depositBtn,
  );

  // ── Transaction History ──
  const txHeading = el('p', { class: 'text-sm bold', style: 'padding-top:var(--space-md)' }, 'Transaction History');
  const txList = el('ul', { class: 'tx-list' });
  const emptyMsg = el('p', { class: 'secondary text-sm' }, 'No transactions yet.');

  function renderTx() {
    clear(txList);
    if (store.transactions.length === 0) {
      txList.appendChild(emptyMsg);
      return;
    }
    for (const tx of [...store.transactions].reverse()) {
      const item = el('li', { class: 'tx-item' },
        el('span', null, tx.date),
        el('span', { class: 'bold' }, `+${formatCurrency(tx.amount)}`),
      );
      txList.appendChild(item);
    }
  }

  const wrapper = el('div', { class: 'finance-panel' },
    balanceEl,
    el('hr', { class: 'divider' }),
    qrSection,
    el('hr', { class: 'divider' }),
    limitForm,
    limitStatus,
    el('hr', { class: 'divider' }),
    form,
    depositStatus,
    txHeading,
    txList,
  );

  parent.appendChild(wrapper);
  renderLimit();
  renderTx();
}

function formatCurrency(n) {
  return `€${n.toFixed(2)}`;
}
