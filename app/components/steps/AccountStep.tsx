"use client";

import { useState } from "react";
import type { SignUpData } from "../SignUpFlow";

interface AccountStepProps {
  data: SignUpData;
  updateData: (updates: Partial<SignUpData>) => void;
  onNext: () => void;
}

export function AccountStep({ data, updateData, onNext }: AccountStepProps) {
  const [isCreating, setIsCreating] = useState(false);

  const canProceed =
    data.fullName.trim().length > 1 &&
    data.email.trim().length > 3 &&
    data.password.trim().length >= 8 &&
    data.acceptedTerms;

  const handleContinue = () => {
    if (!canProceed) return;
    setIsCreating(true);

    setTimeout(() => {
      updateData({ accountCreated: true });
      setIsCreating(false);
      onNext();
    }, 900);
  };

  return (
    <div className="signup-step">
      <div className="step-header">
        <h1>Create Your Account</h1>
        <p className="subtitle">
          Sign up first, then we&apos;ll configure your plan and build your twin.
        </p>
      </div>

      <div className="signup-card">
        <label className="field">
          <span>Full name</span>
          <input
            type="text"
            value={data.fullName}
            onChange={(e) => updateData({ fullName: e.target.value })}
            placeholder="Alex Morgan"
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={data.email}
            onChange={(e) => updateData({ email: e.target.value })}
            placeholder="alex@company.com"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={data.password}
            onChange={(e) => updateData({ password: e.target.value })}
            placeholder="At least 8 characters"
          />
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={data.acceptedTerms}
            onChange={(e) => updateData({ acceptedTerms: e.target.checked })}
          />
          <span>I agree to the Terms and Privacy Policy.</span>
        </label>
      </div>

      <div className="step-actions">
        <button
          className="btn-primary"
          onClick={handleContinue}
          disabled={!canProceed || isCreating}
        >
          {isCreating ? "Creating account..." : "Continue to Subscription"}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
