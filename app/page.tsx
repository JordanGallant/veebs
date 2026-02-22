"use client";

import { useState } from "react";
import LandingPage from "./components/LandingPage";
import PricingPage from "./components/PricingPage";
import SignUpFlow, { type SignUpData } from "./components/SignUpFlow";

type AppView = "landing" | "pricing" | "signup" | "dashboard";

export default function Home() {
  const [view, setView] = useState<AppView>("landing");
  const [dashboardSeed, setDashboardSeed] = useState<Partial<SignUpData>>({});

  if (view === "landing") {
    return (
      <LandingPage
        onSignUp={() => setView("signup")}
        onPricing={() => setView("pricing")}
      />
    );
  }

  if (view === "pricing") {
    return (
      <PricingPage
        onBack={() => setView("landing")}
        onSignUp={() => setView("signup")}
      />
    );
  }

  return (
    <SignUpFlow
      startAtDashboard={view === "dashboard"}
      initialData={view === "dashboard" ? dashboardSeed : undefined}
    />
  );
}
