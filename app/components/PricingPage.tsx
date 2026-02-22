"use client";

interface PricingPageProps {
  onBack: () => void;
  onSignUp: () => void;
}

import SpikyPanel from "./SpikyPanel";

const PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$19",
    subtitle: "per month",
    description: "For personal usage and lightweight daily assistance.",
    bullets: ["Core twin automation", "Voice cloning", "Basic spending controls"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    subtitle: "per month",
    description: "For power users who rely on their twin every day.",
    bullets: [
      "Higher throughput and memory",
      "Priority runtime and faster responses",
      "Advanced spending guardrails",
    ],
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$99",
    subtitle: "per month",
    description: "For heavy usage and team-level operations.",
    bullets: ["Top-tier reasoning", "Multi-workflow automation", "Team-ready controls"],
  },
];

export default function PricingPage({ onBack, onSignUp }: PricingPageProps) {
  return (
    <div className="landing-page pricing-page">
      <header className="landing-header">
        <div className="logo">Cyber Twin</div>
        <div className="landing-header-actions">
          <button className="landing-link secondary" onClick={onBack}>
            Back
          </button>
          <button className="landing-link" onClick={onSignUp}>
            Create account
          </button>
        </div>
      </header>

      <main className="landing-main">
        <SpikyPanel elementType="section" className="landing-hero pricing-hero">
          <p className="eyebrow">Pricing</p>
          <h1>Simple plans that scale with your twin.</h1>
          <p className="hero-subtitle">
            All plans include twin setup, dashboard controls, and WhatsApp
            access. Upgrade anytime as your usage grows.
          </p>
        </SpikyPanel>

        <section className="pricing-grid">
          {PRICING_PLANS.map((plan) => (
            <SpikyPanel
              elementType="article"
              key={plan.id}
              className={`pricing-card ${plan.featured ? "featured" : ""}`}
            >
              <h2>{plan.name}</h2>
              <p className="price">
                {plan.price}
                <span>{plan.subtitle}</span>
              </p>
              <p className="plan-text">{plan.description}</p>
              <ul className="plan-list">
                {plan.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <button className="btn-primary btn-wide" onClick={onSignUp}>
                Choose {plan.name}
              </button>
            </SpikyPanel>
          ))}
        </section>
      </main>
    </div>
  );
}
