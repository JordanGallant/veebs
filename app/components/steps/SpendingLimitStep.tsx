"use client";

import type { SignUpData } from "../SignUpFlow";

interface SpendingLimitStepProps {
  data: SignUpData;
  updateData: (updates: Partial<SignUpData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PRESET_LIMITS = [50, 100, 250, 500];

export function SpendingLimitStep({
  data,
  updateData,
  onNext,
  onBack,
}: SpendingLimitStepProps) {
  return (
    <div className="spending-step">
      <div className="step-header">
        <h1>Set Twin Spending Limit</h1>
        <p className="subtitle">
          Define how much your twin can spend on bookings, purchases, and
          actions each month.
        </p>
      </div>

      <div className="spending-card">
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
              updateData({ spendingLimit: parseInt(e.target.value, 10) })
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
          {PRESET_LIMITS.map((amount) => (
            <button
              key={amount}
              className={`preset-btn ${
                data.spendingLimit === amount ? "active" : ""
              }`}
              onClick={() => updateData({ spendingLimit: amount })}
            >
              ${amount}
            </button>
          ))}
        </div>

        <div className="credit-info">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
          </svg>
          <span>Limits reset monthly and can be updated anytime.</span>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
          </svg>
          Back
        </button>
        <button className="btn-primary" onClick={onNext}>
          Create Twin
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
