import { store } from './store.js';

export const PLAN_OPTIONS = [
  {
    id: 'trial',
    title: 'Trial',
    price: 'EUR 10 one-time',
    copy: 'Get your twin and 100 text messages to try it out.',
    messages: 100,
    support: false,
    walletBonus: 0,
    amountUsd: 10,
  },
  {
    id: 'monthly',
    title: 'Monthly',
    price: 'EUR 55,5 / month',
    copy: 'Get 5,555 text messages per month and customer support.',
    messages: 5555,
    support: true,
    walletBonus: 0,
    amountUsd: 55.5,
  },
  {
    id: 'yearly',
    title: 'Yearly',
    price: 'EUR 555 / year',
    copy: 'Get 5,555 text messages per month, customer support, and EUR 55 in your twin wallet.',
    messages: 5555,
    support: true,
    walletBonus: 55,
    amountUsd: 555,
  },
];

export function getPlanById(planId) {
  return PLAN_OPTIONS.find((plan) => plan.id === planId) || null;
}

export function applyPlanSelection(planId) {
  if (planId === 'skip') {
    store.selectedPlan = 'skip';
    store.messageQuota = null;
    store.hasCustomerSupport = false;
    return null;
  }

  const plan = getPlanById(planId);
  if (!plan) return null;

  store.selectedPlan = plan.id;
  store.messageQuota = plan.messages;
  store.hasCustomerSupport = plan.support;

  if (plan.walletBonus > 0) {
    const hasBonus = store.transactions.some(
      (transaction) => transaction.type === 'bonus' && transaction.planId === plan.id,
    );

    if (!hasBonus) {
      store.balance += plan.walletBonus;
      store.transactions.push({
        planId: plan.id,
        amount: plan.walletBonus,
        type: 'bonus',
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    }
  }

  return plan;
}
