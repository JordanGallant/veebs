"use client";

import { useState } from "react";
import type { SignUpData } from "../SignUpFlow";

interface CreditStepProps {
  data: SignUpData;
  updateData: (updates: Partial<SignUpData>) => void;
  onNext: () => void;
}

const AI_CREDIT_OPTIONS = [
  { value: 10, label: "$10", description: "Starter" },
  { value: 20, label: "$20", description: "Basic", popular: true },
  { value: 50, label: "$50", description: "Pro" },
  { value: 100, label: "$100", description: "Power User" },
];

export function CreditStep({ data, updateData, onNext }: CreditStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectPayment = () => {
    setIsConnecting(true);
    // Simulate payment connection
    setTimeout(() => {
      updateData({ paymentConnected: true });
      setIsConnecting(false);
    }, 1500);
  };

  const canProceed = data.paymentConnected;

  return (
    <div className="credit-step">
      <div className="step-header">
        <h1>Set Up Your Credits</h1>
        <p className="subtitle">
          Your twin needs two types of credits to operate. Set them up now.
        </p>
      </div>

      <div className="credit-cards">
        {/* AI Power Credit Card */}
        <div className="credit-card">
          <div className="credit-card-header">
            <div className="credit-icon ai-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a1 1 0 0 1 1 1v1.17a7.001 7.001 0 0 1 4.83 4.83H19a1 1 0 1 1 0 2h-1.17a7.001 7.001 0 0 1-4.83 4.83V19a1 1 0 1 1-2 0v-1.17a7.001 7.001 0 0 1-4.83-4.83H5a1 1 0 1 1 0-2h1.17A7.001 7.001 0 0 1 11 4.17V3a1 1 0 0 1 1-1Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
              </svg>
            </div>
            <div>
              <h3>AI Power Credit</h3>
              <p className="credit-description">
                Powers your twin&apos;s intelligence, conversations, and tasks
              </p>
            </div>
          </div>

          <div className="credit-options">
            {AI_CREDIT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`credit-option ${
                  data.aiCredit === option.value ? "selected" : ""
                } ${option.popular ? "popular" : ""}`}
                onClick={() => updateData({ aiCredit: option.value })}
              >
                {option.popular && <span className="popular-badge">Popular</span>}
                <span className="option-value">{option.label}</span>
                <span className="option-desc">{option.description}</span>
              </button>
            ))}
          </div>

          <div className="credit-info">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
            </svg>
            <span>Used for AI processing, API calls, and compute</span>
          </div>
        </div>

        {/* Twin Spending Limit Card */}
        <div className="credit-card">
          <div className="credit-card-header">
            <div className="credit-icon spending-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-8v5h-2v-5H8l4-4 4 4h-3Z" />
              </svg>
            </div>
            <div>
              <h3>Twin Spending Limit</h3>
              <p className="credit-description">
                Maximum your twin can spend on your behalf per month
              </p>
            </div>
          </div>

          <div className="spending-limit-section">
            <div className="limit-display">
              <span className="limit-currency">$</span>
              <span className="limit-value">{data.spendingLimit}</span>
              <span className="limit-period">/month</span>
            </div>

            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={data.spendingLimit}
                onChange={(e) =>
                  updateData({ spendingLimit: parseInt(e.target.value) })
                }
                className="limit-slider"
              />
              <div className="slider-labels">
                <span>$0</span>
                <span>$500</span>
                <span>$1000</span>
              </div>
            </div>

            <div className="limit-presets">
              <button
                className={`preset-btn ${data.spendingLimit === 50 ? "active" : ""}`}
                onClick={() => updateData({ spendingLimit: 50 })}
              >
                $50
              </button>
              <button
                className={`preset-btn ${data.spendingLimit === 100 ? "active" : ""}`}
                onClick={() => updateData({ spendingLimit: 100 })}
              >
                $100
              </button>
              <button
                className={`preset-btn ${data.spendingLimit === 250 ? "active" : ""}`}
                onClick={() => updateData({ spendingLimit: 250 })}
              >
                $250
              </button>
              <button
                className={`preset-btn ${data.spendingLimit === 500 ? "active" : ""}`}
                onClick={() => updateData({ spendingLimit: 500 })}
              >
                $500
              </button>
            </div>
          </div>

          <div className="credit-info">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
            </svg>
            <span>Your twin can make purchases, book services, send gifts</span>
          </div>
        </div>
      </div>

      {/* Payment Connection */}
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

      {/* Next Button */}
      <div className="step-actions">
        <button
          className="btn-primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
