import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { createCheckout, createDeposit, getWalletBalances } from '../lib/api.js';

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

  const walletChildren = [
    el('p', { class: 'text-sm bold' }, 'Solana Wallet'),
  ];
  if (solQr) walletChildren.push(solQr);
  walletChildren.push(solAddrEl);
  if (solExplorer) walletChildren.push(solExplorer);

  walletChildren.push(el('hr', { class: 'divider' }));
  walletChildren.push(el('p', { class: 'text-sm bold' }, 'EVM Wallet (Base Sepolia)'));
  if (evmQr) walletChildren.push(evmQr);
  walletChildren.push(evmAddrEl);
  if (evmExplorer) walletChildren.push(evmExplorer);
  walletChildren.push(copyStatus);

  const walletSection = el('div', { class: 'wallet-qr-section' }, ...walletChildren);

  // ── Deposit via Stripe ──
  const amountLabel = el('label', { for: 'deposit-amount', class: 'text-sm' }, 'Deposit Amount (USD)');
  const amountInput = el('input', {
    class: 'input', type: 'number', id: 'deposit-amount',
    min: '1', step: '1', placeholder: '10',
  });
  const depositBtn = el('button', { class: 'btn' }, 'Deposit via Stripe');
  const directBtn = el('button', { class: 'btn btn--secondary' }, 'Direct Deposit (Dev)');
  const depositStatus = el('p', { class: 'secondary text-sm' });

  on(depositBtn, 'click', async () => {
    const val = parseFloat(amountInput.value);
    if (isNaN(val) || val <= 0) { depositStatus.textContent = 'Enter an amount.'; return; }

    depositBtn.setAttribute('disabled', '');
    depositBtn.textContent = 'Redirecting...';
    depositStatus.textContent = '';

    try {
      const checkout = await createCheckout(val);
      if (checkout.checkout_url) {
        window.location.href = checkout.checkout_url;
      } else {
        depositStatus.textContent = 'Checkout not available.';
        depositBtn.removeAttribute('disabled');
        depositBtn.textContent = 'Deposit via Stripe';
      }
    } catch (err) {
      depositStatus.textContent = err.message;
      depositBtn.removeAttribute('disabled');
      depositBtn.textContent = 'Deposit via Stripe';
    }
  });

  on(directBtn, 'click', async () => {
    const val = parseFloat(amountInput.value);
    if (isNaN(val) || val <= 0) { depositStatus.textContent = 'Enter an amount.'; return; }

    directBtn.setAttribute('disabled', '');
    directBtn.textContent = 'Depositing...';
    depositStatus.textContent = '';

    try {
      const result = await createDeposit(val);
      if (result.success) {
        depositStatus.textContent = `Deposited $${val} USDC. TX: ${(result.tx_hash || '').slice(0, 12)}...`;
        amountInput.value = '';
        // Refresh balances
        refreshBalances();
      } else {
        depositStatus.textContent = 'Deposit failed.';
      }
    } catch (err) {
      depositStatus.textContent = err.message;
    }
    directBtn.removeAttribute('disabled');
    directBtn.textContent = 'Direct Deposit (Dev)';
  });

  const depositForm = el('div', { class: 'deposit-form' },
    el('div', { style: 'flex:1;display:flex;flex-direction:column;gap:var(--space-xs)' }, amountLabel, amountInput),
    el('div', { style: 'display:flex;flex-direction:column;gap:var(--space-xs)' }, depositBtn, directBtn),
  );

  // ── Rocks Balance ──
  const rocksEl = store.rocks > 0
    ? el('p', { class: 'text-sm' }, `Rocks: ${store.rocks}`)
    : null;

  const wrapper = el('div', { class: 'finance-panel' },
    balanceGrid,
    el('hr', { class: 'divider' }),
    walletSection,
    el('hr', { class: 'divider' }),
    depositForm,
    depositStatus,
  );

  if (rocksEl) wrapper.appendChild(rocksEl);
  parent.appendChild(wrapper);

  // Fetch real balances
  refreshBalances();

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
