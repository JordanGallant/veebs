"use client";

import { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import type { SignUpData } from "../SignUpFlow";

interface ProfileStepProps {
  data: SignUpData;
  updateData: (updates: Partial<SignUpData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PERSONALITY_OPTIONS = [
  { id: "friendly", label: "Friendly", icon: "🤝" },
  { id: "professional", label: "Professional", icon: "💼" },
  { id: "witty", label: "Witty", icon: "⚡" },
  { id: "chill", label: "Chill", icon: "😌" },
  { id: "direct", label: "Direct", icon: "🎯" },
  { id: "diplomatic", label: "Diplomatic", icon: "🕊️" },
  { id: "creative", label: "Creative", icon: "🎨" },
  { id: "analytical", label: "Analytical", icon: "📊" },
];

const VOICE_SEGMENTS = Array.from({ length: 15 });

export function ProfileStep({
  data,
  updateData,
  onNext,
  onBack,
}: ProfileStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceMeterRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Handle photo upload
  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateData({ photo: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle voice recording simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Animate voice meter when recording
  useEffect(() => {
    if (!voiceMeterRef.current || !isRecording) return;

    const ctx = gsap.context(() => {
      gsap.to(".voice-segment", {
        scaleY: () => gsap.utils.random(0.3, 1.5),
        transformOrigin: "center",
        duration: 0.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: {
          each: 0.03,
          from: "center",
          repeat: -1,
          yoyo: true,
        },
      });
    }, voiceMeterRef);

    return () => ctx.revert();
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      updateData({ voiceRecording: true, voiceDuration: recordingDuration });
    } else {
      setIsRecording(true);
      setRecordingDuration(0);
    }
  };

  const toggleTrait = (traitId: string) => {
    const current = data.personalityTraits;
    const updated = current.includes(traitId)
      ? current.filter((t) => t !== traitId)
      : [...current, traitId];
    updateData({ personalityTraits: updated });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const canProceed = data.photo && data.voiceRecording;

  return (
    <div className="profile-step">
      <div className="step-header">
        <h1>Build Your Twin</h1>
        <p className="subtitle">
          Upload your photo, record your voice, and set your twin&apos;s personality.
        </p>
      </div>

      <div className="profile-grid-signup">
        {/* Left Column - Photo & Voice */}
        <div className="profile-media">
          {/* Photo Upload */}
          <div className="media-card">
            <h3>Your Portrait</h3>
            <button
              className={`photo-upload-zone ${data.photo ? "has-photo" : ""}`}
              onClick={handlePhotoClick}
            >
              {data.photo ? (
                <img src={data.photo} alt="Your portrait" />
              ) : (
                <>
                  <div className="upload-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96ZM14 13v4h-4v-4H7l5-5 5 5h-3Z" />
                    </svg>
                  </div>
                  <span>Click to upload photo</span>
                  <small>or drag and drop</small>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                hidden
              />
            </button>
            {data.photo && (
              <button
                className="change-photo-btn"
                onClick={handlePhotoClick}
              >
                Change photo
              </button>
            )}
          </div>

          {/* Voice Recording */}
          <div className="media-card">
            <h3>Voice Cloning</h3>
            <div className="voice-recorder">
              <button
                className={`record-btn ${isRecording ? "recording" : ""} ${
                  data.voiceRecording && !isRecording ? "completed" : ""
                }`}
                onClick={toggleRecording}
              >
                {isRecording ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : data.voiceRecording ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4Zm6-4a1 1 0 1 1 2 0 8 8 0 0 1-7 7.94V22h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.06A8 8 0 0 1 4 11a1 1 0 1 1 2 0 6 6 0 1 0 12 0Z" />
                  </svg>
                )}
              </button>

              <div className="recorder-info">
                {isRecording ? (
                  <>
                    <span className="recording-status">
                      <span className="recording-dot" />
                      Recording... {formatDuration(recordingDuration)}
                    </span>
                    <span className="recording-hint">Tap to stop</span>
                  </>
                ) : data.voiceRecording ? (
                  <>
                    <span className="recording-status success">
                      ✓ Voice captured ({formatDuration(data.voiceDuration)})
                    </span>
                    <span className="recording-hint">Tap to re-record</span>
                  </>
                ) : (
                  <>
                    <span className="recording-status">
                      Tap to start recording
                    </span>
                    <span className="recording-hint">
                      Speak naturally for 30+ seconds
                    </span>
                  </>
                )}
              </div>

              {/* Voice Visualizer */}
              <div
                className={`voice-visualizer ${isRecording ? "active" : ""}`}
                ref={voiceMeterRef}
              >
                {VOICE_SEGMENTS.map((_, idx) => (
                  <span key={idx} className="voice-segment" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Personality */}
        <div className="profile-personality">
          <div className="personality-card">
            <h3>Personality Traits</h3>
            <p className="personality-subtitle">
              Select up to 4 traits that describe how your twin should interact
            </p>

            <div className="traits-grid">
              {PERSONALITY_OPTIONS.map((trait) => (
                <button
                  key={trait.id}
                  className={`trait-btn ${
                    data.personalityTraits.includes(trait.id) ? "selected" : ""
                  }`}
                  onClick={() => toggleTrait(trait.id)}
                  disabled={
                    !data.personalityTraits.includes(trait.id) &&
                    data.personalityTraits.length >= 4
                  }
                >
                  <span className="trait-icon">{trait.icon}</span>
                  <span className="trait-label">{trait.label}</span>
                </button>
              ))}
            </div>

            <div className="traits-count">
              {data.personalityTraits.length}/4 selected
            </div>
          </div>

          <div className="personality-card">
            <h3>Custom Instructions</h3>
            <p className="personality-subtitle">
              Anything specific you want your twin to know?
            </p>
            <textarea
              className="custom-instructions"
              placeholder="e.g., I prefer short emails. Always sign off with 'Best'. Don't schedule meetings before 10am..."
              value={data.customInstructions}
              onChange={(e) =>
                updateData({ customInstructions: e.target.value })
              }
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn-secondary" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />
          </svg>
          Back
        </button>
        <button className="btn-primary" onClick={onNext} disabled={!canProceed}>
          Continue to Spending Limit
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
