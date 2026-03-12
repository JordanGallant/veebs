import { el, on, clear } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { searchDomains, registerDomain, getDnsRecords, addDnsRecord, deleteDnsRecord } from '../lib/api.js';

export function createDomains(parent) {
  // ── Search Section ──
  const searchInput = el('input', {
    class: 'input', type: 'text',
    placeholder: 'Search domains (e.g. myagent)',
    maxlength: '63',
  });
  const searchBtn = el('button', { class: 'btn' }, 'Search');
  const searchStatus = el('p', { class: 'secondary text-sm' });
  const resultsWrap = el('div', { class: 'domain-results' });

  const searchRow = el('div', { class: 'domain-search-row' },
    el('div', { style: 'flex:1' }, searchInput),
    searchBtn,
  );

  async function doSearch() {
    const keyword = searchInput.value.trim();
    if (!keyword) { searchStatus.textContent = 'Enter a keyword.'; return; }

    searchBtn.setAttribute('disabled', '');
    searchBtn.textContent = '...';
    searchStatus.textContent = '';
    clear(resultsWrap);

    try {
      const data = await searchDomains(keyword);
      const results = data.results || [];
      if (results.length === 0) {
        searchStatus.textContent = 'No results found.';
      } else {
        for (const r of results) {
          resultsWrap.appendChild(renderDomainResult(r));
        }
      }
    } catch (err) {
      searchStatus.textContent = err.message;
    }

    searchBtn.removeAttribute('disabled');
    searchBtn.textContent = 'Search';
  }

  on(searchBtn, 'click', doSearch);
  on(searchInput, 'keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  function renderDomainResult(r) {
    const card = el('div', { class: `domain-card ${r.available ? '' : 'domain-card--taken'}` });

    const name = el('span', { class: 'domain-card-name' }, r.domain);
    const badge = el('span', {
      class: `domain-card-badge ${r.available ? 'domain-card-badge--available' : 'domain-card-badge--taken'}`,
    }, r.available ? 'Available' : 'Taken');

    const topRow = el('div', { class: 'domain-card-top' }, name, badge);
    card.appendChild(topRow);

    if (r.available && r.price_usd) {
      const price = el('span', { class: 'domain-card-price' }, `$${r.price_usd}`);
      const renewal = r.renewal_usd ? el('span', { class: 'secondary text-xs' }, ` / renewal $${r.renewal_usd}/yr`) : null;
      const priceRow = el('div', { class: 'domain-card-prices' }, price, renewal);
      card.appendChild(priceRow);

      const regBtn = el('button', { class: 'btn btn--sm' }, 'Register');
      const regStatus = el('p', { class: 'secondary text-xs' });

      on(regBtn, 'click', () => {
        showConfirm(r.domain, r.price_usd, regBtn, regStatus);
      });

      card.appendChild(el('div', { class: 'domain-card-actions' }, regBtn, regStatus));
    }

    return card;
  }

  function showConfirm(domain, priceUsd, regBtn, regStatus) {
    regBtn.textContent = `Confirm $${priceUsd}?`;
    regBtn.className = 'btn btn--sm btn--confirm';
    regStatus.textContent = 'Paid from Base Sepolia USDC';

    // Replace click handler
    const handler = async () => {
      regBtn.removeEventListener('click', handler);
      regBtn.setAttribute('disabled', '');
      regBtn.textContent = 'Registering...';
      regStatus.textContent = '';

      try {
        const result = await registerDomain(domain);
        regBtn.textContent = 'Registered';
        regStatus.textContent = `Order #${result.order_id} — $${result.cost_usd}`;
        if (!store._registeredDomains.includes(domain)) {
          store._registeredDomains.push(domain);
        }
        loadMyDomains();
      } catch (err) {
        regBtn.removeAttribute('disabled');
        regBtn.textContent = 'Register';
        regBtn.className = 'btn btn--sm';
        regStatus.textContent = err.message;
      }
    };
    regBtn.addEventListener('click', handler);
  }

  // ── My Domains Section ──
  const myDomainsTitle = el('p', { class: 'text-sm bold' }, 'My Domains');
  const myDomainsList = el('div', { class: 'my-domains-list' });
  const myDomainsWrap = el('div', { class: 'my-domains-section' }, myDomainsTitle, myDomainsList);
  myDomainsWrap.style.display = 'none';

  // ── DNS Manager (shown when a domain is selected) ──
  const dnsPanel = el('div', { class: 'dns-panel' });
  dnsPanel.style.display = 'none';

  function loadMyDomains() {
    // Pull registered domains from the store's transaction history or Supabase
    // For now, we track them locally from successful registrations
    // The backend tracks them in transactions table
    if (!store.agentId) return;

    // We'll use the search endpoint to check owned domains
    // For MVP, show domains from local session + allow DNS management
    const domains = store._registeredDomains || [];
    if (domains.length === 0) {
      myDomainsWrap.style.display = 'none';
      return;
    }
    myDomainsWrap.style.display = '';
    clear(myDomainsList);
    for (const domain of domains) {
      const manageBtn = el('button', { class: 'btn btn--sm btn--outline' }, 'DNS');
      on(manageBtn, 'click', () => openDnsManager(domain));
      myDomainsList.appendChild(
        el('div', { class: 'my-domain-item' },
          el('span', { class: 'my-domain-name' }, domain),
          manageBtn,
        ),
      );
    }
  }

  // Track registered domains in store for session
  if (!store._registeredDomains) store._registeredDomains = [];

  function openDnsManager(domain) {
    dnsPanel.style.display = '';
    clear(dnsPanel);

    const title = el('p', { class: 'text-sm bold' }, `DNS — ${domain}`);
    const closeBtn = el('button', { class: 'btn btn--sm btn--outline' }, 'Close');
    on(closeBtn, 'click', () => { dnsPanel.style.display = 'none'; });

    const header = el('div', { class: 'dns-header' }, title, closeBtn);
    const recordsWrap = el('div', { class: 'dns-records' });
    const loadingEl = el('p', { class: 'secondary text-sm' }, 'Loading records...');
    recordsWrap.appendChild(loadingEl);

    // Add record form
    const typeSelect = el('select', { class: 'input input--sm' },
      el('option', { value: 'A' }, 'A'),
      el('option', { value: 'AAAA' }, 'AAAA'),
      el('option', { value: 'CNAME' }, 'CNAME'),
      el('option', { value: 'TXT' }, 'TXT'),
      el('option', { value: 'MX' }, 'MX'),
    );
    const nameInput = el('input', { class: 'input input--sm', type: 'text', placeholder: 'Name (e.g. www)' });
    const contentInput = el('input', { class: 'input input--sm', type: 'text', placeholder: 'Content (e.g. 1.2.3.4)' });
    const ttlInput = el('input', { class: 'input input--sm', type: 'number', placeholder: 'TTL', value: '600' });
    const addBtn = el('button', { class: 'btn btn--sm' }, 'Add');
    const addStatus = el('p', { class: 'secondary text-xs' });

    on(addBtn, 'click', async () => {
      const rType = typeSelect.value;
      const rName = nameInput.value.trim();
      const rContent = contentInput.value.trim();
      const rTtl = parseInt(ttlInput.value) || 600;

      if (!rContent) { addStatus.textContent = 'Content is required.'; return; }

      addBtn.setAttribute('disabled', '');
      addBtn.textContent = '...';
      addStatus.textContent = '';

      try {
        await addDnsRecord(domain, rType, rContent, rName, rTtl);
        nameInput.value = '';
        contentInput.value = '';
        ttlInput.value = '600';
        addStatus.textContent = 'Record added.';
        fetchRecords();
      } catch (err) {
        addStatus.textContent = err.message;
      }

      addBtn.removeAttribute('disabled');
      addBtn.textContent = 'Add';
    });

    const addForm = el('div', { class: 'dns-add-form' },
      el('p', { class: 'text-xs bold' }, 'Add Record'),
      el('div', { class: 'dns-add-row' }, typeSelect, nameInput, contentInput, ttlInput, addBtn),
      addStatus,
    );

    dnsPanel.append(header, recordsWrap, addForm);

    async function fetchRecords() {
      clear(recordsWrap);
      recordsWrap.appendChild(el('p', { class: 'secondary text-sm' }, 'Loading...'));

      try {
        const data = await getDnsRecords(domain);
        const records = data.records || [];
        clear(recordsWrap);

        if (records.length === 0) {
          recordsWrap.appendChild(el('p', { class: 'secondary text-sm' }, 'No DNS records.'));
          return;
        }

        const table = el('div', { class: 'dns-table' });
        const headerRow = el('div', { class: 'dns-row dns-row--header' },
          el('span', null, 'Type'),
          el('span', null, 'Name'),
          el('span', null, 'Content'),
          el('span', null, 'TTL'),
          el('span'),
        );
        table.appendChild(headerRow);

        for (const rec of records) {
          const delBtn = el('button', { class: 'btn btn--sm btn--danger' }, 'Del');
          on(delBtn, 'click', async () => {
            delBtn.setAttribute('disabled', '');
            delBtn.textContent = '...';
            try {
              await deleteDnsRecord(domain, rec.id);
              fetchRecords();
            } catch (err) {
              delBtn.removeAttribute('disabled');
              delBtn.textContent = 'Del';
              addStatus.textContent = err.message;
            }
          });

          table.appendChild(el('div', { class: 'dns-row' },
            el('span', null, rec.type || ''),
            el('span', null, rec.name || ''),
            el('span', { class: 'dns-content' }, rec.content || ''),
            el('span', null, String(rec.ttl || '')),
            delBtn,
          ));
        }

        recordsWrap.appendChild(table);
      } catch (err) {
        clear(recordsWrap);
        recordsWrap.appendChild(el('p', { class: 'secondary text-sm' }, err.message));
      }
    }

    fetchRecords();
  }

  // ── Wrapper ──
  const wrapper = el('div', { class: 'domains-panel' },
    el('p', { class: 'text-sm bold' }, 'Domain Search'),
    el('p', { class: 'secondary text-xs' }, 'Register a domain for your x402 endpoint. Paid from Base Sepolia USDC.'),
    searchRow,
    searchStatus,
    resultsWrap,
    el('hr', { class: 'divider' }),
    myDomainsWrap,
    dnsPanel,
  );

  parent.appendChild(wrapper);
  loadMyDomains();
}
