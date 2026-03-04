"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  RefreshCw,
  Share2,
  Check,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "../Button";
import { Container } from "../Container";

interface SuccessStepProps {
  twinData: {
    photo: string | null;
    voiceRecording: Blob | null;
    personalityPrompt: string;
  };
  onRestart: () => void;
}

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  rotation: number;
  scale: number;
}

// Generate confetti pieces
function generateConfetti(count: number): ConfettiPiece[] {
  const colors = [
    "#2563eb", // blue-600
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#ec4899", // pink-500
    "#8b5cf6", // violet-500
    "#06b6d4", // cyan-500
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
  }));
}

// Staggered container variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

// Confetti component
function Confetti({ count = 50 }: { count?: number }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    setPieces(generateConfetti(count));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <AnimatePresence>
        {pieces.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{
              x: `${piece.x}%`,
              y: -20,
              rotate: piece.rotation,
              scale: piece.scale,
              opacity: 1,
            }}
            animate={{
              y: "120vh",
              rotate: piece.rotation + 720,
              x: `${piece.x + (Math.random() - 0.5) * 20}%`,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 3 + Math.random() * 2,
              ease: "easeOut",
              delay: Math.random() * 0.5,
            }}
            style={{
              position: "absolute",
              width: "8px",
              height: "8px",
              backgroundColor: piece.color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Success checkmark with draw-on animation
function SuccessCheckmark() {
  return (
    <div className="relative">
      <motion.div
        className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring" as const, stiffness: 200 }}
      >
        <motion.svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          initial="hidden"
          animate="visible"
        >
          <motion.path
            d="M10 20 L17 27 L30 12"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: {
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { delay: 0.4, duration: 0.4, ease: "easeOut" },
                  opacity: { delay: 0.4, duration: 0.1 },
                },
              },
            }}
          />
        </motion.svg>
      </motion.div>

      {/* Ring animation */}
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-emerald-500"
        initial={{ scale: 1, opacity: 0 }}
        animate={{
          scale: [1, 1.5, 1.8],
          opacity: [0.5, 0.2, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatDelay: 0.5,
        }}
      />
    </div>
  );
}

// Twin Avatar with ring animation
function TwinAvatar({ photo }: { photo: string | null }) {
  return (
    <div className="relative">
      {/* Outer rotating ring */}
      <motion.div
        className="absolute -inset-4 rounded-full border-2 border-dashed border-zinc-300"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Secondary ring */}
      <motion.div
        className="absolute -inset-8 rounded-full border border-zinc-200"
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />

      {/* Pulsing glow */}
      <motion.div
        className="absolute -inset-2 rounded-full bg-blue-500/20 blur-xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Avatar container */}
      <motion.div
        className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-100 border-4 border-white shadow-2xl"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: "spring" as const, stiffness: 150 }}
        whileHover={{ scale: 1.05 }}
      >
        {photo ? (
          <img
            src={photo}
            alt="Your Cyber Twin"
            className="w-full h-full object-cover"
            style={{ filter: "contrast(1.05) saturate(0.95)" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-zinc-400">
            <User size={48} />
          </div>
        )}

        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />
      </motion.div>

      {/* Sparkle decorations */}
      {[
        { x: -40, y: -20, delay: 0.5 },
        { x: 40, y: -30, delay: 0.7 },
        { x: 50, y: 20, delay: 0.9 },
        { x: -30, y: 30, delay: 1.1 },
      ].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: "50%", top: "50%" }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            x: pos.x,
            y: pos.y,
          }}
          transition={{
            delay: pos.delay,
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
        >
          <Sparkles size={16} className="text-amber-400" />
        </motion.div>
      ))}
    </div>
  );
}

// Glass personality badge
function PersonalityBadge({ prompt }: { prompt: string }) {
  // Extract a short personality label from the prompt
  const getPersonalityLabel = () => {
    if (prompt.toLowerCase().includes("fun") || prompt.toLowerCase().includes("energetic"))
      return "Enthusiastic";
    if (prompt.toLowerCase().includes("serious") || prompt.toLowerCase().includes("professional"))
      return "Professional";
    if (prompt.toLowerCase().includes("chill") || prompt.toLowerCase().includes("calm"))
      return "Laid-back";
    if (prompt.toLowerCase().includes("creative") || prompt.toLowerCase().includes("artistic"))
      return "Creative";
    return "Balanced";
  };

  return (
    <motion.div
      variants={itemVariants}
      className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl backdrop-blur-xl bg-white/60 border border-white/40 shadow-lg"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white">
        <Sparkles size={18} />
      </div>
      <div className="text-left">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
          Personality Type
        </p>
        <p className="text-sm font-semibold text-zinc-950">{getPersonalityLabel()}</p>
      </div>
    </motion.div>
  );
}

// Share button with copy functionality
function ShareButton({ onShare, copied }: { onShare: () => void; copied: boolean }) {
  return (
    <motion.div variants={itemVariants} className="relative">
      <Button
        onClick={onShare}
        variant="primary"
        className="w-full sm:w-auto min-w-[160px]"
        leftIcon={
          copied ? <Check size={18} /> : <Share2 size={18} />
        }
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={copied ? "copied" : "share"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center"
          >
            {copied ? "Copied!" : "Share"}
          </motion.span>
        </AnimatePresence>
      </Button>

      {/* Share options popup */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-950 text-white text-sm rounded-xl whitespace-nowrap z-50"
          >
            Link copied to clipboard!
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-950 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SuccessStep({ twinData, onRestart }: SuccessStepProps) {
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Stop confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleShare = useCallback(() => {
    const text = "I just created my Cyber Twin with AI! Check it out:";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-zinc-50 relative overflow-hidden">
      {/* Confetti effect */}
      <AnimatePresence>{showConfetti && <Confetti count={60} />}</AnimatePresence>

      {/* Background ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-violet-500/5 blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, -40, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <Container size="generous" className="relative z-10 w-full max-w-lg">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          {/* Success Checkmark */}
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <SuccessCheckmark />
          </motion.div>

          {/* Twin Avatar */}
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <TwinAvatar photo={twinData.photo} />
          </motion.div>

          {/* Title */}
          <motion.h2
            variants={itemVariants}
            className="text-4xl font-semibold text-zinc-950 mb-3"
          >
            Twin Created!
          </motion.h2>

          {/* Subtitle */}
          <motion.p variants={itemVariants} className="text-zinc-500 mb-8 max-w-sm mx-auto">
            Your cyber twin is ready! Say hello to your digital self.
          </motion.p>

          {/* Personality Badge */}
          <div className="mb-10">
            <PersonalityBadge prompt={twinData.personalityPrompt} />
          </div>

          {/* Action Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <ShareButton onShare={handleShare} copied={copied} />

            <Button
              onClick={onRestart}
              variant="secondary"
              className="w-full sm:w-auto min-w-[160px]"
              leftIcon={<RefreshCw size={18} />}
            >
              Create New
            </Button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={itemVariants}
            className="mt-12 pt-8 border-t border-zinc-200"
          >
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Voice Cloned", value: "100%" },
                { label: "Personality", value: "Active" },
                { label: "Status", value: "Online" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100 text-zinc-600 mb-2">
                    <Check size={18} />
                  </div>
                  <p className="text-lg font-semibold text-zinc-950">{stat.value}</p>
                  <p className="text-xs text-zinc-400">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </div>
  );
}
