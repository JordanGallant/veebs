"use client";

import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { CreditStep } from "./steps/CreditStep";
import { ProfileStep } from "./steps/ProfileStep";
import { GenerateStep } from "./steps/GenerateStep";

export type SignUpData = {
  // Credit
  aiCredit: number;
  spendingLimit: number;
  paymentConnected: boolean;
  // Profile
  photo: string | null;
  voiceRecording: boolean;
  voiceDuration: number;
  personalityTraits: string[];
  customInstructions: string;
};

const INITIAL_DATA: SignUpData = {
  aiCredit: 20,
  spendingLimit: 100,
  paymentConnected: false,
  photo: null,
  voiceRecording: false,
  voiceDuration: 0,
  personalityTraits: [],
  customInstructions: "",
};

const STEPS = [
  { id: "credit", label: "Credits" },
  { id: "profile", label: "Profile" },
  { id: "generate", label: "Generate" },
];

export default function SignUpFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<SignUpData>(INITIAL_DATA);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const contentRef = useRef<HTMLDivElement>(null);

  const updateData = (updates: Partial<SignUpData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const goToNext = () => {
    if (currentStep < STEPS.length - 1) {
      setDirection("next");
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentStep > 0) {
      setDirection("prev");
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Animate step transitions
  useEffect(() => {
    if (!contentRef.current) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".step-content",
        {
          opacity: 0,
          y: direction === "next" ? 20 : -20,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
        }
      );
    }, contentRef);

    return () => ctx.revert();
  }, [currentStep, direction]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <CreditStep
            data={data}
            updateData={updateData}
            onNext={goToNext}
          />
        );
      case 1:
        return (
          <ProfileStep
            data={data}
            updateData={updateData}
            onNext={goToNext}
            onBack={goToPrev}
          />
        );
      case 2:
        return <GenerateStep data={data} />;
      default:
        return null;
    }
  };

  return (
    <div className="signup-flow">
      {/* Progress Header */}
      <header className="signup-header">
        <div className="logo">Cyber Twin</div>
        <nav className="step-indicator">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`step-dot ${
                index === currentStep
                  ? "active"
                  : index < currentStep
                  ? "completed"
                  : ""
              }`}
            >
              <span className="step-number">
                {index < currentStep ? "✓" : index + 1}
              </span>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="signup-main" ref={contentRef}>
        <div className="step-content">{renderStep()}</div>
      </main>
    </div>
  );
}
