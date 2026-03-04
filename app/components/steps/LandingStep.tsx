"use client";

import { motion } from "framer-motion";
import { Camera, Mic, Sparkles, ArrowRight } from "lucide-react";

interface LandingStepProps {
  onStart: () => void;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

const floatingVariants = {
  initial: { y: 0 },
  animate: {
    y: [-8, 8, -8],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

const pulseVariants = {
  initial: { scale: 1, opacity: 0.4 },
  animate: {
    scale: [1, 1.15, 1],
    opacity: [0.4, 0.2, 0.4],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

const features = [
  { icon: Camera, label: "Photo" },
  { icon: Mic, label: "Voice" },
  { icon: Sparkles, label: "Magic" },
];

export function LandingStep({ onStart }: LandingStepProps) {
  return (
    <div className="min-h-[100dvh] w-full bg-zinc-50 relative overflow-hidden">
      {/* Grain texture overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Mesh gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-[30%] -right-[20%] w-[70%] h-[70%] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)",
          }}
          variants={pulseVariants}
          initial="initial"
          animate="animate"
        />
        <motion.div
          className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
          }}
          variants={pulseVariants}
          initial="initial"
          animate="animate"
          transition={{ delay: 1.5 }}
        />
      </div>

      {/* Main content grid */}
      <div className="relative z-20 min-h-[100dvh] grid grid-cols-1 lg:grid-cols-[55fr_45fr]">
        {/* Left side - Content */}
        <motion.div
          className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-16 lg:py-0"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Eyebrow */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200/50 text-xs font-medium text-zinc-600 tracking-wide uppercase">
              <Sparkles size={12} className="text-blue-600" />
              Digital Companion
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold text-zinc-950 tracking-tight leading-[0.95] mb-6"
          >
            Create your
            <br />
            <span className="text-blue-600">Cyber Twin</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-md mb-8"
          >
            Clone yourself into a digital companion. Upload a photo, record your voice, 
            and define their personality. Your twin learns to think and speak like you.
          </motion.p>

          {/* CTA Button with magnetic effect */}
          <motion.div variants={itemVariants} className="mb-10">
            <motion.button
              onClick={onStart}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-zinc-950 text-zinc-50 rounded-full font-medium text-base overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
            >
              {/* Button shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
              <span className="relative z-10">Create Your Twin</span>
              <motion.span
                className="relative z-10"
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={springTransition}
              >
                <ArrowRight size={18} />
              </motion.span>
            </motion.button>
          </motion.div>

          {/* Feature chips */}
          <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zinc-200/60 text-sm text-zinc-700 shadow-sm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...springTransition, delay: 0.6 + index * 0.1 }}
                whileHover={{ y: -2, transition: springTransition }}
              >
                <feature.icon size={14} className="text-blue-600" />
                <span className="font-medium">{feature.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right side - Visual */}
        <div className="hidden lg:flex items-center justify-center relative p-12">
          {/* Abstract visual composition */}
          <div className="relative w-full max-w-lg aspect-square">
            {/* Main circular element */}
            <motion.div
              className="absolute inset-[15%] rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200/50 border border-zinc-200/60"
              variants={floatingVariants}
              initial="initial"
              animate="animate"
              style={{
                backdropFilter: "blur(10px)",
              }}
            >
              {/* Inner content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-32 h-32 rounded-full bg-zinc-950 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles size={48} className="text-zinc-50" />
                </motion.div>
              </div>
            </motion.div>

            {/* Orbiting elements */}
            <motion.div
              className="absolute top-[10%] right-[15%] w-16 h-16 rounded-2xl bg-white border border-zinc-200/60 shadow-lg flex items-center justify-center"
              variants={floatingVariants}
              initial="initial"
              animate="animate"
              transition={{ delay: 0.5 }}
            >
              <Camera size={24} className="text-blue-600" />
            </motion.div>

            <motion.div
              className="absolute bottom-[20%] left-[10%] w-14 h-14 rounded-xl bg-zinc-950 flex items-center justify-center shadow-xl"
              variants={floatingVariants}
              initial="initial"
              animate="animate"
              transition={{ delay: 1 }}
            >
              <Mic size={20} className="text-zinc-50" />
            </motion.div>

            {/* Decorative rings */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 400 400"
              fill="none"
            >
              <motion.circle
                cx="200"
                cy="200"
                r="150"
                stroke="currentColor"
                strokeWidth="1"
                className="text-zinc-300/50"
                initial={{ pathLength: 0, rotate: 0 }}
                animate={{ pathLength: 1, rotate: 360 }}
                transition={{
                  pathLength: { duration: 2, ease: "easeInOut" },
                  rotate: { duration: 30, repeat: Infinity, ease: "linear" },
                }}
              />
              <motion.circle
                cx="200"
                cy="200"
                r="180"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="8 8"
                className="text-zinc-300/30"
                initial={{ rotate: 0 }}
                animate={{ rotate: -360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              />
            </svg>

            {/* Gradient orbs */}
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-blue-600/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-indigo-600/10 blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
