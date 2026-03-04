"use client";

import { useState } from "react";
import { LandingStep } from "./steps/LandingStep";
import { PhotoStep } from "./steps/PhotoStep";
import { VoicePersonalityStep } from "./steps/VoicePersonalityStep";
import { ProcessingStep } from "./steps/ProcessingStep";
import { SuccessStep } from "./steps/SuccessStep";

export type TwinData = {
  photo: string | null;
  voiceRecording: Blob | null;
  personalityPrompt: string;
};

type FlowStep = "landing" | "photo" | "voice-personality" | "processing" | "success";

export function CyberTwinFlow() {
  const [currentStep, setCurrentStep] = useState<FlowStep>("landing");
  const [twinData, setTwinData] = useState<TwinData>({
    photo: null,
    voiceRecording: null,
    personalityPrompt: "",
  });

  const goToPhoto = () => setCurrentStep("photo");
  const goToVoicePersonality = () => setCurrentStep("voice-personality");
  const goToProcessing = () => setCurrentStep("processing");
  const goToSuccess = () => setCurrentStep("success");
  const goToLanding = () => {
    setTwinData({ photo: null, voiceRecording: null, personalityPrompt: "" });
    setCurrentStep("landing");
  };

  const updatePhoto = (photo: string) => {
    setTwinData((prev) => ({ ...prev, photo }));
    goToVoicePersonality();
  };

  const updateVoicePersonality = (voiceRecording: Blob, personalityPrompt: string) => {
    setTwinData((prev) => ({ ...prev, voiceRecording, personalityPrompt }));
    goToProcessing();
  };

  const handleProcessingComplete = () => {
    goToSuccess();
  };

  switch (currentStep) {
    case "landing":
      return <LandingStep onStart={goToPhoto} />;
    case "photo":
      return <PhotoStep onComplete={updatePhoto} />;
    case "voice-personality":
      return <VoicePersonalityStep onComplete={updateVoicePersonality} />;
    case "processing":
      return <ProcessingStep onComplete={handleProcessingComplete} />;
    case "success":
      return <SuccessStep twinData={twinData} onRestart={goToLanding} />;
    default:
      return <LandingStep onStart={goToPhoto} />;
  }
}
