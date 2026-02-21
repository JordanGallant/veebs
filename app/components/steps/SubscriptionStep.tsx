"use client";

import { useState } from "react";
import type { SignUpData } from "../SignUpFlow";

interface SubscriptionStepProps {
  data: SignUpData;
  updateData: (updates: Partial<SignUpData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PLAN_OPTIONS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$19/mo",
    description: "Essential twin intelligence and automation",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$49/mo",
    description: "Higher throughput, better memory, priority runtime",
    popular: true,
  },
  {
    id: "scale" as const,
    name: "Scale",
    price: "$99/mo",
    description: "Advanced reasoning, heavy usage, team-ready",
  },
];

export function SubscriptionStep({
  data,
  updateData,
  onNext,
  onBack,
}: SubscriptionStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectPayment = () => {
    setIsConnecting(true);
    setTimeout(() => {
      updateData({ paymentConnected: true });
      setIsConnecting(false);
    }, 1200);
  };

  const canProceed = data.paymentConnected;

  return (
    <div className="subscription-step">
      <div className="step-header">
        <h1>Choose a Subscription</h1>
        <p className="subtitle">
          Your plan now covers AI power usage, so no separate AI credit setup is
          required.
        </p>
      </div>

      <div className="subscription-grid">
        {PLAN_OPTIONS.map((plan) => (
          <button
            key={plan.id}
            className={`subscription-card ${
              data.subscriptionPlan === plan.id ? "selected" : ""
            } ${plan.popular ? "popular" : ""}`}
            onClick={() => updateData({ subscriptionPlan: plan.id })}
          >
            {plan.popular && <span className="popular-badge">Most chosen</span>}
            <h3>{plan.name}</h3>
            <p className="plan-price">{plan.price}</p>
            <p className="plan-description">{plan.description}</p>
          </button>
        ))}
      </div>

      <div className="payment-section">
        {!data.paymentConnected ? (
          <button
            className="connect-payment-btn"
            onClick={handleConnectPayment}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="spinner" />
                Connecting...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2Zm0 14H4v-6h16v6Zm0-10H4V6h16v2Z" />
                </svg>
                Connect Payment Method
              </>
            )}
          </button>
        ) : (
          <div className="payment-connected">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
            </svg>
            <span>Payment method connected</span>
          </div>
        )}
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
          </svg>
          Back
        </button>
        <button className="btn-primary" onClick={onNext} disabled={!canProceed}>
          Continue to Build Twin
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
