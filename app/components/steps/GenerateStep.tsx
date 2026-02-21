"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { SignUpData } from "../SignUpFlow";

interface GenerateStepProps {
  data: SignUpData;
}

const GENERATION_STEPS = [
  { id: "photo", label: "Analyzing portrait..." },
  { id: "voice", label: "Processing voice clone..." },
  { id: "personality", label: "Configuring personality..." },
  { id: "sync", label: "Syncing with cloud..." },
  { id: "ready", label: "Your twin is ready!" },
];

export function GenerateStep({ data }: GenerateStepProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const twinRef = useRef<HTMLDivElement>(null);

  // Simulate generation steps
  useEffect(() => {
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
  }, []);

  // Animate twin appearance when complete
  useEffect(() => {
    if (!isComplete || !twinRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".twin-avatar-final",
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.7)" }
      );
      gsap.fromTo(
        ".twin-details",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, delay: 0.3, ease: "power2.out" }
      );
      gsap.fromTo(
        ".twin-actions",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, delay: 0.5, ease: "power2.out" }
      );
    }, twinRef);

    return () => ctx.revert();
  }, [isComplete]);

  const getTraitLabel = (traitId: string) => {
    const labels: Record<string, string> = {
      friendly: "Friendly",
      professional: "Professional",
      witty: "Witty",
      chill: "Chill",
      direct: "Direct",
      diplomatic: "Diplomatic",
      creative: "Creative",
      analytical: "Analytical",
    };
    return labels[traitId] || traitId;
  };

  if (!isComplete) {
    return (
      <div className="generate-step" ref={containerRef}>
        <div className="generating-container">
          {/* Animated Avatar Preview */}
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

          {/* Progress Steps */}
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
      <div className="twin-reveal">
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
          <h2>Your Twin is Ready</h2>
          <p className="twin-summary">
            AI Credit: <strong>${data.aiCredit}</strong> · Spending Limit:{" "}
            <strong>${data.spendingLimit}/mo</strong>
          </p>

          <div className="twin-traits">
            {data.personalityTraits.slice(0, 4).map((trait) => (
              <span key={trait} className="trait-tag">
                {getTraitLabel(trait)}
              </span>
            ))}
          </div>

          {data.customInstructions && (
            <div className="twin-instructions">
              <p>&ldquo;{data.customInstructions}&rdquo;</p>
            </div>
          )}
        </div>

        <div className="twin-actions">
          <button className="btn-primary btn-large">
            Meet Your Twin
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4a8 8 0 0 1 8 8 8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8Zm0 2a6 6 0 0 0-6 6 6 6 0 0 0 6 6 6 6 0 0 0 6-6 6 6 0 0 0-6-6Zm0 2a4 4 0 0 1 4 4h-2a2 2 0 0 0-2-2V8Z" />
            </svg>
          </button>
          <button className="btn-text">Go to Dashboard</button>
        </div>
      </div>
    </div>
  );
}
