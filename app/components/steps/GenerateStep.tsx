"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import gsap from "gsap";
import type { SignUpData } from "../SignUpFlow";

interface GenerateStepProps {
  data: SignUpData;
  updateData: (updates: Partial<SignUpData>) => void;
  onDashboardReady: () => void;
  skipGeneration?: boolean;
}

type DashboardSection =
  | "plan"
  | "voice"
  | "name"
  | "spending"
  | "instructions";

const GENERATION_STEPS = [
  { id: "photo", label: "Analyzing portrait..." },
  { id: "voice", label: "Processing voice clone..." },
  { id: "personality", label: "Configuring personality..." },
  { id: "controls", label: "Applying spending controls..." },
  { id: "sync", label: "Syncing with cloud..." },
  { id: "ready", label: "Your twin is ready!" },
];

const SPENDING_PRESETS = [50, 100, 250, 500];

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function GenerateStep({
  data,
  updateData,
  onDashboardReady,
  skipGeneration = false,
}: GenerateStepProps) {
  const [currentStep, setCurrentStep] = useState(
    skipGeneration ? GENERATION_STEPS.length - 1 : 0
  );
  const [isComplete, setIsComplete] = useState(skipGeneration);
  const [openSection, setOpenSection] = useState<DashboardSection | null>("plan");
  const containerRef = useRef<HTMLDivElement>(null);
  const twinRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const hasNotifiedDashboardRef = useRef(false);

  useEffect(() => {
    if (skipGeneration) return;

    const intervals: NodeJS.Timeout[] = [];

    GENERATION_STEPS.forEach((_, index) => {
      const timeout = setTimeout(
        () => {
          setCurrentStep(index);
          if (index === GENERATION_STEPS.length - 1) {
            setIsComplete(true);
          }
        },
        (index + 1) * 1500
      );
      intervals.push(timeout);
    });

    return () => intervals.forEach(clearTimeout);
  }, [skipGeneration]);

  useEffect(() => {
    if (!isComplete || !twinRef.current) return;

    if (!hasNotifiedDashboardRef.current) {
      onDashboardReady();
      hasNotifiedDashboardRef.current = true;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".twin-avatar-final",
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" }
      );
      gsap.fromTo(
        ".dashboard-panel",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, delay: 0.3, ease: "power2.out" }
      );
    }, twinRef);

    return () => ctx.revert();
  }, [isComplete, onDashboardReady]);

  const getPlanLabel = (planId: SignUpData["subscriptionPlan"]) => {
    const plans: Record<SignUpData["subscriptionPlan"], string> = {
      starter: "Starter",
      pro: "Pro",
      scale: "Scale",
    };
    return plans[planId];
  };

  const getTwinTitle = () => {
    const name = data.fullName.trim();
    if (!name) return "Your Twin";
    if (name.endsWith("s") || name.endsWith("S")) return `${name}' Twin`;
    return `${name}'s Twin`;
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      updateData({ photo: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const voiceDuration = data.voiceDuration > 0 ? data.voiceDuration : 30;
  const monthlySpend =
    data.spendingLimit === 0
      ? 0
      : Math.min(data.spendingLimit, Math.max(12, Math.round(data.spendingLimit * 0.38)));
  const spendingPercent =
    data.spendingLimit > 0
      ? Math.min(100, Math.round((monthlySpend / data.spendingLimit) * 100))
      : 0;

  const toggleSection = (section: DashboardSection) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  if (!isComplete) {
    return (
      <div className="generate-step" ref={containerRef}>
        <div className="generating-container">
          <div className="generating-avatar">
            {data.photo ? (
              <img src={data.photo} alt="Generating twin" />
            ) : (
              <div className="avatar-placeholder">
                <span>?</span>
              </div>
            )}
            <div className="generating-ring" />
            <div className="generating-ring second" />
          </div>

          <h2>Creating Your Twin</h2>

          <div className="generation-progress">
            {GENERATION_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`progress-step ${
                  index < currentStep
                    ? "completed"
                    : index === currentStep
                    ? "active"
                    : "pending"
                }`}
              >
                <div className="step-dot">
                  {index < currentStep ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
                    </svg>
                  ) : index === currentStep ? (
                    <span className="step-spinner" />
                  ) : null}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="generate-step complete" ref={twinRef}>
      <div className="twin-dashboard">
        <section className="dashboard-panel profile-panel">
          <div className="twin-avatar-final">
            {data.photo ? (
              <img src={data.photo} alt="Your twin" />
            ) : (
              <div className="avatar-placeholder">
                <span>YT</span>
              </div>
            )}
            <div className="ai-badge">✧ AI</div>
          </div>

          <div className="twin-details">
            <h2>{getTwinTitle()}</h2>
          </div>
        </section>

        <section className="dashboard-panel settings-panel">
          <h3>Twin Controls</h3>

          <div className="dashboard-accordion">
            <section className={`accordion-item ${openSection === "plan" ? "open" : ""}`}>
              <button
                type="button"
                className="accordion-trigger"
                onClick={() => toggleSection("plan")}
                aria-expanded={openSection === "plan"}
              >
                <span className="accordion-title">Plan</span>
                <span className="accordion-meta-wrap">
                  <span className="accordion-meta">{getPlanLabel(data.subscriptionPlan)}</span>
                  <span className="accordion-caret" aria-hidden="true">▾</span>
                </span>
              </button>
              <div className="accordion-content">
                <div className="accordion-content-inner">
                  <label className="field">
                    <span>Subscription plan</span>
                    <select
                      className="dashboard-select"
                      value={data.subscriptionPlan}
                      onChange={(e) =>
                        updateData({
                          subscriptionPlan: e.target.value as SignUpData["subscriptionPlan"],
                        })
                      }
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="scale">Scale</option>
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className={`accordion-item ${openSection === "voice" ? "open" : ""}`}>
              <button
                type="button"
                className="accordion-trigger"
                onClick={() => toggleSection("voice")}
                aria-expanded={openSection === "voice"}
              >
                <span className="accordion-title">Voice</span>
                <span className="accordion-meta-wrap">
                  <span className="accordion-meta">
                    {data.voiceRecording
                      ? `Ready (${formatDuration(voiceDuration)})`
                      : "Not configured"}
                  </span>
                  <span className="accordion-caret" aria-hidden="true">▾</span>
                </span>
              </button>
              <div className="accordion-content">
                <div className="accordion-content-inner">
                  <div className="voice-controls">
                    <div className="dashboard-row">
                      <span className="dashboard-label">Sample length</span>
                      <input
                        type="range"
                        min="10"
                        max="120"
                        step="5"
                        value={voiceDuration}
                        onChange={(e) =>
                          updateData({
                            voiceRecording: true,
                            voiceDuration: parseInt(e.target.value, 10),
                          })
                        }
                        className="limit-slider"
                      />
                      <div className="slider-labels">
                        <span>0:10</span>
                        <span>{formatDuration(voiceDuration)}</span>
                        <span>2:00</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="preset-btn"
                      onClick={() =>
                        updateData({
                          voiceRecording: !data.voiceRecording,
                          voiceDuration: data.voiceRecording ? 0 : voiceDuration,
                        })
                      }
                    >
                      {data.voiceRecording ? "Disable voice clone" : "Enable voice clone"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className={`accordion-item ${openSection === "name" ? "open" : ""}`}>
              <button
                type="button"
                className="accordion-trigger"
                onClick={() => toggleSection("name")}
                aria-expanded={openSection === "name"}
              >
                <span className="accordion-title">Name</span>
                <span className="accordion-meta-wrap">
                  <span className="accordion-meta">{getTwinTitle()}</span>
                  <span className="accordion-caret" aria-hidden="true">▾</span>
                </span>
              </button>
              <div className="accordion-content">
                <div className="accordion-content-inner">
                  <label className="field">
                    <span>Twin name</span>
                    <input
                      type="text"
                      value={data.fullName}
                      onChange={(e) => updateData({ fullName: e.target.value })}
                      placeholder="Boris"
                    />
                  </label>
                  <button
                    type="button"
                    className="change-photo-btn"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Change photo
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    hidden
                  />
                </div>
              </div>
            </section>

            <section className={`accordion-item ${openSection === "spending" ? "open" : ""}`}>
              <button
                type="button"
                className="accordion-trigger"
                onClick={() => toggleSection("spending")}
                aria-expanded={openSection === "spending"}
              >
                <span className="accordion-title">Twin spending limit</span>
                <span className="accordion-meta-wrap">
                  <span className="accordion-meta">
                    ${monthlySpend} / ${data.spendingLimit} used
                  </span>
                  <span className="accordion-caret" aria-hidden="true">▾</span>
                </span>
              </button>
              <div className="accordion-content">
                <div className="accordion-content-inner">
                  <div className="budget-summary">
                    <span>${monthlySpend} spent this month</span>
                    <strong>{spendingPercent}%</strong>
                  </div>
                  <div className="budget-track">
                    <div
                      className="budget-fill"
                      style={{ width: `${spendingPercent}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="budget-caption">
                    Remaining budget: ${Math.max(0, data.spendingLimit - monthlySpend)}
                  </p>

                  <div className="limit-display">
                    <span className="limit-currency">$</span>
                    <span className="limit-value">{data.spendingLimit}</span>
                    <span className="limit-period">/month</span>
                  </div>

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

                  <div className="limit-presets">
                    {SPENDING_PRESETS.map((amount) => (
                      <button
                        type="button"
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
                </div>
              </div>
            </section>

            <section
              className={`accordion-item ${openSection === "instructions" ? "open" : ""}`}
            >
              <button
                type="button"
                className="accordion-trigger"
                onClick={() => toggleSection("instructions")}
                aria-expanded={openSection === "instructions"}
              >
                <span className="accordion-title">Instructions</span>
                <span className="accordion-meta-wrap">
                  <span className="accordion-meta">
                    {data.customInstructions.trim()
                      ? `${Math.min(data.customInstructions.length, 120)} chars`
                      : "Not set"}
                  </span>
                  <span className="accordion-caret" aria-hidden="true">▾</span>
                </span>
              </button>
              <div className="accordion-content">
                <div className="accordion-content-inner">
                  <label className="field">
                    <span>Custom instructions</span>
                    <textarea
                      className="custom-instructions"
                      placeholder="Add behavior rules for your twin..."
                      value={data.customInstructions}
                      onChange={(e) =>
                        updateData({ customInstructions: e.target.value })
                      }
                      rows={4}
                    />
                  </label>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="dashboard-panel whatsapp-panel">
          <h3>Talk to your twin on WhatsApp, scan QR code</h3>
          <a
            href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            target="_blank"
            rel="noreferrer"
            className="qr-link"
            aria-label="Open WhatsApp QR mockup link"
          >
            <div className="qr-mock" aria-hidden="true">
              {Array.from({ length: 49 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`qr-cell ${idx % 3 === 0 ? "dark" : ""}`}
                />
              ))}
            </div>
            <span>Open WhatsApp Link</span>
          </a>
        </section>
      </div>
    </div>
  );
}
