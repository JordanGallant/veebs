"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { AccountStep } from "./steps/AccountStep";
import { SubscriptionStep } from "./steps/SubscriptionStep";
import { ProfileStep } from "./steps/ProfileStep";
import { SpendingLimitStep } from "./steps/SpendingLimitStep";
import { GenerateStep } from "./steps/GenerateStep";

interface SignUpFlowProps {
  startAtDashboard?: boolean;
  initialData?: Partial<SignUpData>;
}

export type SignUpData = {
  // Account
  fullName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
  accountCreated: boolean;
  // Subscription
  subscriptionPlan: "starter" | "pro" | "scale";
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
  fullName: "",
  email: "",
  password: "",
  acceptedTerms: false,
  accountCreated: false,
  subscriptionPlan: "pro",
  spendingLimit: 100,
  paymentConnected: false,
  photo: null,
  voiceRecording: false,
  voiceDuration: 0,
  personalityTraits: [],
  customInstructions: "",
};

const STEPS = [
  { id: "account", label: "Sign Up" },
  { id: "subscription", label: "Subscription" },
  { id: "profile", label: "Build Twin" },
  { id: "spending", label: "Spending Limit" },
  { id: "generate", label: "Generate" },
];

export default function SignUpFlow({
  startAtDashboard = false,
  initialData,
}: SignUpFlowProps) {
  const [currentStep, setCurrentStep] = useState(startAtDashboard ? 4 : 0);
  const [isDashboardMode, setIsDashboardMode] = useState(startAtDashboard);
  const [data, setData] = useState<SignUpData>({
    ...INITIAL_DATA,
    ...initialData,
  });
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

  const handleDashboardReady = useCallback(() => {
    setIsDashboardMode(true);
  }, []);

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
          <AccountStep
            data={data}
            updateData={updateData}
            onNext={goToNext}
          />
        );
      case 1:
        return (
          <SubscriptionStep
            data={data}
            updateData={updateData}
            onNext={goToNext}
            onBack={goToPrev}
          />
        );
      case 2:
        return (
          <ProfileStep
            data={data}
            updateData={updateData}
            onNext={goToNext}
            onBack={goToPrev}
          />
        );
      case 3:
        return (
          <SpendingLimitStep
            data={data}
            updateData={updateData}
            onNext={goToNext}
            onBack={goToPrev}
          />
        );
      case 4:
        return (
          <GenerateStep
            data={data}
            updateData={updateData}
            onDashboardReady={handleDashboardReady}
            skipGeneration={startAtDashboard}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="signup-flow">
      {/* Progress Header */}
      <header className={`signup-header ${isDashboardMode ? "dashboard-header" : ""}`}>
        <div className="cyber-logo">Cyber Twin</div>
        {!isDashboardMode && (
          <nav className="step-indicator">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`step-dot ${index === currentStep
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
        )}
      </header>

      {/* Main Content */}
      <main className="signup-main" ref={contentRef}>
        <div className="step-content">{renderStep()}</div>
      </main>
    </div>
  );
}
