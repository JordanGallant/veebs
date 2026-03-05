import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';

export function createWallet(parent) {
  const balanceEl = el('div', { class: 'wallet-balance' }, formatCurrency(store.balance));

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

  const amountLabel = el('label', { for: 'deposit-amount', class: 'text-sm' }, 'Deposit Amount');
  const amountInput = el('input', {
    class: 'input',
    type: 'number',
    id: 'deposit-amount',
    min: '0.01',
    step: '0.01',
    placeholder: '0.00',
  });
  const depositBtn = el('button', { class: 'btn' }, 'Deposit');

  const form = el('div', { class: 'deposit-form' },
    el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:var(--space-xs)' }, amountLabel, amountInput),
    depositBtn,
  );

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

  on(depositBtn, 'click', () => {
    const val = parseFloat(amountInput.value);
    if (isNaN(val) || val <= 0) return;

    store.balance += val;
    store.transactions.push({
      amount: val,
      type: 'deposit',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    });

    balanceEl.textContent = formatCurrency(store.balance);
    amountInput.value = '';
    renderTx();
  });

  const wrapper = el('div', { class: 'tab-content', style: 'gap:var(--space-sm)' },
    balanceEl,
    el('hr', { class: 'divider' }),
    limitForm,
    limitStatus,
    el('hr', { class: 'divider' }),
    form,
    txHeading,
    txList,
  );

  parent.appendChild(wrapper);
  renderLimit();
  renderTx();
}

function formatCurrency(n) {
  return `$${n.toFixed(2)}`;
}
