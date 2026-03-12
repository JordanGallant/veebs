import { store } from './store.js';

export const PLAN_OPTIONS = [
  {
    id: 'trial',
    title: 'Trial',
    price: '€10 one-time',
    copy: 'Get your twin and 10 credits to try it out.',
    details: ['10 credits', 'One-time payment'],
    messages: 10,
    support: false,
    recommended: false,
  },
  {
    id: 'monthly',
    title: 'Monthly',
    price: '€200 / month',
    copy: 'Get 200 credits each month and customer support.',
    details: ['200 credits / month', 'Customer support'],
    messages: 200,
    support: true,
    recommended: true,
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

  return plan;
}
