"use client";

import { useState } from "react";
import type { SignUpData } from "./SignUpFlow";

interface LandingPageProps {
  onSignUp: () => void;
  onLogin: (seedData: Partial<SignUpData>) => void;
  onPricing: () => void;
}

const toNameFromEmail = (email: string) => {
  const localPart = email.split("@")[0] || "You";
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function LandingPage({
  onSignUp,
  onLogin,
  onPricing,
}: LandingPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canLogin = email.trim().length > 3 && password.trim().length > 3;

  const handleLogin = () => {
    if (!canLogin) return;
    const fullName = toNameFromEmail(email);

    onLogin({
      fullName,
      email,
      paymentConnected: true,
      accountCreated: true,
      subscriptionPlan: "pro",
      voiceRecording: true,
      voiceDuration: 46,
      spendingLimit: 300,
      personalityTraits: ["friendly", "direct"],
      customInstructions:
        "Keep messages concise and prioritize actions by urgency.",
    });
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="logo">Cyber Twin</div>
        <div className="landing-header-actions">
          <button className="landing-link secondary" onClick={onPricing}>
            Pricing
          </button>
          <button className="landing-link" onClick={onSignUp}>
            Create account
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero glass-panel">
          <div className="landing-hero-split">
            <div className="hero-copy">
              <p className="eyebrow">Your Autonomous Companion</p>
              <h1>Launch your digital twin and run your day in one command center.</h1>
              <p className="hero-subtitle">
                Build, train, and manage your twin with voice cloning, spending
                controls, and instant WhatsApp access.
              </p>
              <div className="hero-tags">
                <span>Voice clone</span>
                <span>Spending guardrails</span>
                <span>Live twin controls</span>
              </div>
            </div>

            <div className="hero-image-wrap">
              <img
                src="/images/landing-twin.png"
                alt="Cyber twin preview"
                className="hero-image"
              />
            </div>
          </div>
        </section>

        <section className="entry-grid">
          <article className="entry-card glass-panel login-card">
            <h2>Log in</h2>
            <p>Jump straight to your twin dashboard.</p>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="boris@company.com"
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            <button className="btn-primary" onClick={handleLogin} disabled={!canLogin}>
              Go to dashboard
            </button>
          </article>

          <article className="entry-card glass-panel signup-card-landing">
            <h2>New here?</h2>
            <p>
              Start your guided setup: account, subscription, twin build, and
              spending limit.
            </p>
            <button className="btn-secondary btn-wide" onClick={onSignUp}>
              Start sign up
            </button>
          </article>
        </section>
      </main>
    </div>
  );
}
