"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Sparkles, Cpu, Brain, Wand2, Check, LucideIcon } from "lucide-react";
import { Container } from "../Container";

interface ProcessingStepProps {
  onComplete: () => void;
}

interface Step {
  id: string;
  icon: LucideIcon;
  text: string;
  description: string;
}

const STEPS: Step[] = [
  {
    id: "analyze",
    icon: Cpu,
    text: "Analyzing facial features",
    description: "Mapping unique characteristics...",
  },
  {
    id: "voice",
    icon: Brain,
    text: "Cloning voice patterns",
    description: "Synthesizing vocal signature...",
  },
  {
    id: "personality",
    icon: Wand2,
    text: "Infusing personality",
    description: "Calibrating behavior models...",
  },
  {
    id: "finalize",
    icon: Sparkles,
    text: "Finalizing your twin",
    description: "Applying final touches...",
  },
];

// Morphing blob component
function MorphingBlob({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-xl opacity-60 ${color}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: [0.8, 1.2, 0.9, 1.1, 0.8],
        x: [0, 30, -20, 40, 0],
        y: [0, -30, 20, -40, 0],
        opacity: [0.4, 0.7, 0.5, 0.6, 0.4],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
      style={{
        width: "200px",
        height: "200px",
      }}
    />
  );
}

// Central morphing shape
function CentralMorphingShape({ step }: { step: number }) {
  const colors = [
    "from-blue-500 to-cyan-400",
    "from-violet-500 to-purple-400",
    "from-pink-500 to-rose-400",
    "from-amber-500 to-orange-400",
  ];

  const currentColor = colors[step % colors.length];
  const CurrentIcon = STEPS[step].icon;

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Background blobs */}
      <MorphingBlob color="bg-blue-400" delay={0} />
      <MorphingBlob color="bg-violet-400" delay={2} />
      <MorphingBlob color="bg-pink-400" delay={4} />

      {/* Central rotating ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-dashed border-zinc-300/50"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner pulsing ring */}
      <motion.div
        className={`absolute inset-4 rounded-full bg-gradient-to-br ${currentColor} opacity-20`}
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 10, repeat: Infinity, ease: "linear" },
        }}
      />

      {/* Core shape with morphing */}
      <motion.div
        className={`relative w-24 h-24 rounded-3xl bg-gradient-to-br ${currentColor} shadow-2xl`}
        animate={{
          borderRadius: ["30%", "50%", "30%", "40%", "30%"],
          rotate: [0, 90, 0, -90, 0],
          scale: [1, 1.1, 1, 1.05, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Inner glow */}
        <div className="absolute inset-0 bg-white/20 blur-md rounded-inherit" />
        
        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring" as const, stiffness: 200 }}
            >
              <CurrentIcon size={32} strokeWidth={2} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-full bg-zinc-400/50"
          style={{
            left: "50%",
            top: "50%",
            marginLeft: -6,
            marginTop: -6,
          }}
          animate={{
            x: [
              Math.cos((i * 2 * Math.PI) / 3) * 80,
              Math.cos((i * 2 * Math.PI) / 3) * 80,
            ],
            y: [
              Math.sin((i * 2 * Math.PI) / 3) * 80,
              Math.sin((i * 2 * Math.PI) / 3) * 80,
            ],
          }}
          transition={{
            duration: 0.1,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              left: -68 + Math.cos((i * 2 * Math.PI) / 3) * 80,
              top: -68 + Math.sin((i * 2 * Math.PI) / 3) * 80,
            }}
          >
            <div
              className="absolute w-3 h-3 rounded-full bg-zinc-400/50"
              style={{
                left: 80,
                top: 0,
              }}
            />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

// Step indicator item
function StepItem({
  step,
  index,
  currentStep,
}: {
  step: Step;
  index: number;
  currentStep: number;
}) {
  const isCompleted = index < currentStep;
  const isCurrent = index === currentStep;
  const isPending = index > currentStep;
  const Icon = step.icon;

  return (
    <motion.div
      layout
      className={`
        flex items-center gap-4 p-4 rounded-2xl transition-all duration-500
        ${isCurrent ? "bg-white shadow-lg border border-zinc-100" : ""}
        ${isCompleted ? "opacity-100" : isPending ? "opacity-40" : "opacity-100"}
      `}
    >
      {/* Icon container */}
      <motion.div
        className={`
          relative w-12 h-12 rounded-xl flex items-center justify-center
          ${isCompleted
            ? "bg-emerald-500 text-white"
            : isCurrent
            ? "bg-blue-500 text-white"
            : "bg-zinc-200 text-zinc-400"
          }
        `}
        animate={
          isCurrent
            ? {
                scale: [1, 1.05, 1],
                boxShadow: [
                  "0 0 0 0 rgba(37, 99, 235, 0.4)",
                  "0 0 0 10px rgba(37, 99, 235, 0)",
                ],
              }
            : {}
        }
        transition={{
          duration: 1.5,
          repeat: Infinity,
        }}
      >
        <AnimatePresence mode="wait">
          {isCompleted ? (
            <motion.div
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Check size={20} strokeWidth={3} />
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
            >
              <Icon size={20} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Text content */}
      <div className="flex-1">
        <p
          className={`font-medium text-sm ${
            isCurrent ? "text-zinc-950" : "text-zinc-600"
          }`}
        >
          {step.text}
        </p>
        {isCurrent && (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-zinc-400 mt-0.5"
          >
            {step.description}
          </motion.p>
        )}
      </div>

      {/* Status indicator */}
      <div className="w-6 flex justify-center">
        {isCurrent && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-blue-500"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
}

export function ProcessingStep({ onComplete }: ProcessingStepProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [displayedText, setDisplayedText] = useState("");

  // Progress and step management
  useEffect(() => {
    const duration = 6000; // 6 seconds total
    const interval = 50;
    const steps = duration / interval;
    let current = 0;

    const timer = setInterval(() => {
      current++;
      setProgress((current / steps) * 100);

      const stepIndex = Math.min(
        Math.floor((current / steps) * STEPS.length),
        STEPS.length - 1
      );
      setCurrentStep(stepIndex);

      if (current >= steps) {
        clearInterval(timer);
        setTimeout(onComplete, 800);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onComplete]);

  // Typewriter effect for current step text
  useEffect(() => {
    const text = STEPS[currentStep].text;
    let index = 0;
    setDisplayedText("");

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 40);

    return () => clearInterval(timer);
  }, [currentStep]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-zinc-50 relative overflow-hidden">
      {/* Background ambient animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-violet-500/5 blur-3xl"
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <Container className="relative z-10 w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {/* Central Morphing Shape */}
          <div className="flex justify-center mb-12">
            <CentralMorphingShape step={currentStep} />
          </div>

          {/* Step Title with Typewriter */}
          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-zinc-950 h-8">
              {displayedText}
              <motion.span
                className="inline-block w-0.5 h-6 bg-blue-500 ml-1 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            </h2>
          </div>

          {/* Step Indicators */}
          <div className="space-y-2 mb-10">
            {STEPS.map((step, index) => (
              <StepItem
                key={step.id}
                step={step}
                index={index}
                currentStep={currentStep}
              />
            ))}
          </div>

          {/* Progress Bar with Gradient Shimmer */}
          <div className="relative max-w-xs mx-auto">
            <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 relative"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
                style={{
                  backgroundSize: "200% 100%",
                }}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </motion.div>
            </div>

            {/* Percentage */}
            <motion.p
              className="text-xs font-mono text-zinc-400 mt-3"
              key={Math.round(progress)}
              initial={{ opacity: 0.5, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {Math.round(progress)}%
            </motion.p>
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
