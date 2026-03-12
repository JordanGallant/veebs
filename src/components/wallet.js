import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { createCheckout, getWalletBalances, withdrawFunds, getWithdrawalHistory } from '../lib/api.js';

export function createWallet(parent) {
  // ── Balance Grid ──
  const solBalEl = el('div', { class: 'wallet-balance' }, '$0.00');
  const evmBalEl = el('div', { class: 'wallet-balance' }, '$0.00');

  const balanceGrid = el('div', { class: 'wallet-balance-grid' },
    el('div', { class: 'wallet-balance-card' },
      solBalEl,
      el('p', { class: 'wallet-balance-card-label' }, 'Solana USDC'),
    ),
    el('div', { class: 'wallet-balance-card' },
      evmBalEl,
      el('p', { class: 'wallet-balance-card-label' }, 'Base Sepolia USDC'),
    ),
  );

  // ── Solana Wallet ──
  const solAddr = store.solanaAddress || '';
  const solAddrEl = el('p', {
    class: 'secondary text-xs wallet-address',
    title: 'Click to copy',
    style: 'cursor:pointer;word-break:break-all;',
  }, solAddr || 'No wallet yet');

  const solQr = solAddr
    ? el('img', {
      class: 'wallet-qr',
      src: `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=solana:${solAddr}`,
      alt: 'Solana wallet QR',
      width: '160', height: '160',
      style: 'display:block;margin:var(--space-xs) auto;image-rendering:pixelated;',
    })
    : null;

  const solExplorer = solAddr
    ? el('a', {
      class: 'agent-chip',
      href: `https://explorer.solana.com/address/${solAddr}?cluster=devnet`,
      target: '_blank',
      rel: 'noopener',
    }, 'View on Solscan')
    : null;

  // ── EVM Wallet ──
  const evmAddr = store.evmAddress || '';
  const evmAddrEl = el('p', {
    class: 'secondary text-xs wallet-address',
    title: 'Click to copy',
    style: 'cursor:pointer;word-break:break-all;',
  }, evmAddr || 'No wallet yet');

  const evmQr = evmAddr
    ? el('img', {
      class: 'wallet-qr',
      src: `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${evmAddr}`,
      alt: 'EVM wallet QR',
      width: '160', height: '160',
      style: 'display:block;margin:var(--space-xs) auto;image-rendering:pixelated;',
    })
    : null;

  const evmExplorer = evmAddr
    ? el('a', {
      class: 'agent-chip',
      href: `https://sepolia.basescan.org/address/${evmAddr}`,
      target: '_blank',
      rel: 'noopener',
    }, 'View on Basescan')
    : null;

  const copyStatus = el('p', { class: 'secondary text-xs', style: 'text-align:center' });

  async function copyAddr(addr, label) {
    try {
      await navigator.clipboard.writeText(addr);
      copyStatus.textContent = `${label} copied!`;
      setTimeout(() => { copyStatus.textContent = ''; }, 1500);
    } catch {
      copyStatus.textContent = 'Copy failed';
    }
  }

  if (solAddr) on(solAddrEl, 'click', () => copyAddr(solAddr, 'Solana address'));
  if (evmAddr) on(evmAddrEl, 'click', () => copyAddr(evmAddr, 'EVM address'));

  // ── Deposit helper ──
  function createDepositForm(chain, label) {
    const id = `deposit-amount-${chain}`;
    const amountLabel = el('label', { for: id, class: 'text-sm' }, `Deposit (USD) → ${label}`);
    const amountInput = el('input', {
      class: 'input', type: 'number', id,
      min: '1', step: '1', placeholder: '10',
    });
    const btn = el('button', { class: 'btn' }, 'Deposit');
    const status = el('p', { class: 'secondary text-sm' });

    on(btn, 'click', async () => {
      const val = parseFloat(amountInput.value);
      if (isNaN(val) || val <= 0) { status.textContent = 'Enter an amount.'; return; }

      btn.setAttribute('disabled', '');
      btn.textContent = 'Redirecting...';
      status.textContent = '';

      try {
        const checkout = await createCheckout(val, { chain });
        if (checkout.checkout_url) {
          window.location.href = checkout.checkout_url;
        } else {
          status.textContent = 'Checkout not available.';
          btn.removeAttribute('disabled');
          btn.textContent = 'Deposit';
        }
      } catch (err) {
        status.textContent = err.message;
        btn.removeAttribute('disabled');
        btn.textContent = 'Deposit';
      }
    });

    return el('div', { class: 'deposit-form-section' },
      el('div', { class: 'deposit-form' },
        el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:var(--space-xs)' }, amountLabel, amountInput),
        btn,
      ),
      status,
    );
  }

  // ── Withdraw helper ──
  function createWithdrawForm(chain, label) {
    const id = `withdraw-amount-${chain}`;
    const amountLabel = el('label', { for: id, class: 'text-sm' }, `Withdraw (USD) → ${label}`);
    const amountInput = el('input', {
      class: 'input', type: 'number', id,
      min: '1', step: '1', placeholder: '10',
    });
    const btn = el('button', { class: 'btn btn--outline' }, 'Withdraw');
    const status = el('p', { class: 'secondary text-sm' });
    const resultBox = el('div');

    on(btn, 'click', async () => {
      const val = parseFloat(amountInput.value);
      if (isNaN(val) || val <= 0) { status.textContent = 'Enter an amount.'; return; }

      btn.setAttribute('disabled', '');
      btn.textContent = 'Processing...';
      status.textContent = '';
      clear(resultBox);

      try {
        const result = await withdrawFunds(val, chain);
        amountInput.value = '';
        status.textContent = '';

        const successEl = el('div', { class: 'withdraw-success' },
          el('p', null, `Withdrawn $${result.amount_usd} USDC`),
          result.explorer
            ? el('a', { href: result.explorer, target: '_blank', rel: 'noopener' }, 'View transaction')
            : null,
          result.stripe_transfer_id
            ? el('p', { class: 'secondary text-xs' }, `Stripe: ${result.stripe_transfer_id}`)
            : null,
        );
        clear(resultBox);
        resultBox.appendChild(successEl);
        refreshBalances();
        loadHistory();
      } catch (err) {
        status.textContent = err.message;
      }

      btn.removeAttribute('disabled');
      btn.textContent = 'Withdraw';
    });

    return el('div', { class: 'withdraw-form-section' },
      el('div', { class: 'withdraw-form' },
        el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:var(--space-xs)' }, amountLabel, amountInput),
        btn,
      ),
      status,
      resultBox,
    );
  }

  // ── Solana Section ──
  const solChildren = [el('p', { class: 'text-sm bold' }, 'Solana Wallet')];
  if (solQr) solChildren.push(solQr);
  solChildren.push(solAddrEl);
  if (solExplorer) solChildren.push(solExplorer);
  solChildren.push(createDepositForm('solana', 'Solana USDC'));
  solChildren.push(createWithdrawForm('solana', 'Solana USDC'));
  const solSection = el('div', { class: 'wallet-chain-section' }, ...solChildren);

  // ── EVM Section ──
  const evmChildren = [el('p', { class: 'text-sm bold' }, 'EVM Wallet (Base Sepolia)')];
  if (evmQr) evmChildren.push(evmQr);
  evmChildren.push(evmAddrEl);
  if (evmExplorer) evmChildren.push(evmExplorer);
  evmChildren.push(createDepositForm('base-sepolia', 'Base Sepolia USDC'));
  evmChildren.push(createWithdrawForm('base-sepolia', 'Base Sepolia USDC'));
  const evmSection = el('div', { class: 'wallet-chain-section' }, ...evmChildren);

  // ── Rocks Balance ──
  const rocksEl = store.rocks > 0
    ? el('p', { class: 'text-sm' }, `Rocks: ${store.rocks}`)
    : null;

  const wrapper = el('div', { class: 'finance-panel' },
    balanceGrid,
    copyStatus,
    el('hr', { class: 'divider' }),
    solSection,
    el('hr', { class: 'divider' }),
    evmSection,
  );

  if (rocksEl) wrapper.appendChild(rocksEl);

  // ── Withdrawal History ──
  const historyTitle = el('p', { class: 'text-sm bold withdrawal-history-title' }, 'Withdrawal History');
  const historyList = el('div');
  const historySection = el('div', { class: 'withdrawal-history' }, historyTitle, historyList);
  historySection.style.display = 'none';
  wrapper.appendChild(el('hr', { class: 'divider' }));
  wrapper.appendChild(historySection);

  parent.appendChild(wrapper);

  function loadHistory() {
    getWithdrawalHistory().then((data) => {
      const items = data?.withdrawals || [];
      if (items.length === 0) {
        historySection.style.display = 'none';
        return;
      }
      historySection.style.display = '';
      clear(historyList);
      for (const w of items) {
        const left = el('span', null, `$${w.amount_usd} — ${w.status || 'completed'}`);
        const right = w.tx_signature
          ? el('a', {
            href: `https://explorer.solana.com/tx/${w.tx_signature}?cluster=devnet`,
            target: '_blank',
            rel: 'noopener',
          }, 'tx')
          : el('span', { class: 'secondary' }, new Date(w.created_at).toLocaleDateString());
        historyList.appendChild(el('div', { class: 'withdrawal-item' }, left, right));
      }
    }).catch(() => {});
  }

  // Fetch real balances and history
  refreshBalances();
  loadHistory();

  function refreshBalances() {
    getWalletBalances().then((data) => {
      if (!data?.balances) return;
      const solUsdc = data.balances.solana?.usdc || 0;
      const evmUsdc = data.balances.base_sepolia?.usdc || 0;
      solBalEl.textContent = `$${solUsdc.toFixed(2)}`;
      evmBalEl.textContent = `$${evmUsdc.toFixed(2)}`;
      store.balance = solUsdc + evmUsdc;

      if (data.solana_address && !store.solanaAddress) {
        store.solanaAddress = data.solana_address;
        solAddrEl.textContent = data.solana_address;
      }
      if (data.evm_address && !store.evmAddress) {
        store.evmAddress = data.evm_address;
        evmAddrEl.textContent = data.evm_address;
      }
    }).catch(() => {});
  }
}
