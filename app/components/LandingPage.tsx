"use client";

import type { SignUpData } from "./SignUpFlow";

interface LandingPageProps {
  onSignUp: () => void;
  onPricing: () => void;
}

export default function LandingPage({
  onSignUp,
  onPricing,
}: LandingPageProps) {
  return (
    <div className="landing-page">
      <header className="landing-header" style={{ justifyContent: "flex-end" }}>
        <div className="landing-header-actions">
          <button className="landing-text-link" onClick={onPricing}>
            Pricing
          </button>
          <button className="landing-text-link" onClick={onSignUp}>
            Create account
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-split">
            <div className="hero-copy">
              <div className="cyber-logo prominent-logo">Cyber Twin</div>
              <h1>Your digital twin does the work, so you can relax.</h1>
              <div className="hero-cta">
                <button className="btn-primary start-btn" onClick={onSignUp}>
                  Start
                </button>
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
      </main>
    </div>
  );
}
