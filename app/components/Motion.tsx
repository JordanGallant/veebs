"use client";

import React, { useEffect, useState, createContext, useContext } from "react";
import {
  motion,
  AnimatePresence,
  Variants,
  Transition,
  useReducedMotion,
  HTMLMotionProps,
} from "framer-motion";

// =============================================================================
// REDUCED MOTION CONTEXT & HOOK
// =============================================================================

interface MotionContextValue {
  shouldReduceMotion: boolean;
}

const MotionContext = createContext<MotionContextValue>({
  shouldReduceMotion: false,
});

export const useMotionContext = () => useContext(MotionContext);

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that wraps the app and provides reduced motion preferences.
 * All motion components respect the user's system preferences.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <MotionContext.Provider value={{ shouldReduceMotion: shouldReduceMotion ?? false }}>
      {children}
    </MotionContext.Provider>
  );
}

// =============================================================================
// SPRING CONFIGURATION
// =============================================================================

export const SPRING_CONFIG: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
};

export const SPRING_GENTLE: Transition = {
  type: "spring",
  stiffness: 80,
  damping: 25,
};

export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// =============================================================================
// VARIANTS
// =============================================================================

/**
 * Stagger container variant for orchestrating child animations.
 * Use with staggerChildren and delayChildren for waterfall reveals.
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

/**
 * Fade up item variant for list/grid items entering from below.
 * Combines opacity and Y translation with spring physics.
 */
export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING_CONFIG,
  },
};

/**
 * Scale in variant for elements that need to grow into view.
 * Subtle scale from 0.9 to 1 with spring physics.
 */
export const scaleInItem: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: SPRING_CONFIG,
  },
};

/**
 * Slide in from left variant for sidebar navigation or list items.
 */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: SPRING_CONFIG,
  },
};

/**
 * Slide in from right variant for modals or panels.
 */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: SPRING_CONFIG,
  },
};

/**
 * Fade variant for simple opacity transitions.
 */
export const fadeVariant: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
};

// =============================================================================
// PAGE TRANSITION WRAPPER
// =============================================================================

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageTransition - Wraps page content with AnimatePresence for exit animations.
 * Uses mode="wait" to ensure proper exit animations before new content enters.
 * Respects prefers-reduced-motion.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="page-transition"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
        transition={shouldReduceMotion ? { duration: 0 } : SPRING_CONFIG}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// ANIMATED STEP COMPONENT
// =============================================================================

interface AnimatedStepProps {
  children: React.ReactNode;
  stepKey: string | number;
  direction?: "left" | "right" | "up" | "down";
  className?: string;
}

/**
 * AnimatedStep - Handles enter/exit animations for flow steps.
 * Combines slide and fade for smooth multi-step transitions.
 * Use unique stepKey for AnimatePresence to track state changes.
 */
export function AnimatedStep({
  children,
  stepKey,
  direction = "right",
  className,
}: AnimatedStepProps) {
  const shouldReduceMotion = useReducedMotion();

  const getDirectionOffset = () => {
    if (shouldReduceMotion) return { x: 0, y: 0 };

    switch (direction) {
      case "left":
        return { x: 40, y: 0 };
      case "right":
        return { x: -40, y: 0 };
      case "up":
        return { x: 0, y: 40 };
      case "down":
        return { x: 0, y: -40 };
      default:
        return { x: -40, y: 0 };
    }
  };

  const offset = getDirectionOffset();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{
          opacity: 0,
          x: offset.x,
          y: offset.y,
        }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{
          opacity: 0,
          x: -offset.x,
          y: -offset.y,
        }}
        transition={shouldReduceMotion ? { duration: 0 } : SPRING_CONFIG}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// PULSE ANIMATION COMPONENT
// =============================================================================

interface PulseProps {
  size?: number;
  color?: string;
  intensity?: "subtle" | "medium" | "strong";
  className?: string;
}

/**
 * Pulse - A perpetual pulse animation for recording indicators or status dots.
 * Uses Framer Motion for smooth, performant infinite animation.
 * Respects prefers-reduced-motion by rendering static dot.
 */
export function Pulse({
  size = 12,
  color = "#ef4444",
  intensity = "medium",
  className,
}: PulseProps) {
  const shouldReduceMotion = useReducedMotion();

  const intensityConfig = {
    subtle: { scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] },
    medium: { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] },
    strong: { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] },
  };

  const config = intensityConfig[intensity];

  if (shouldReduceMotion) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: "50%",
        }}
      />
    );
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <motion.div
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: "50%",
        }}
        animate={config}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// =============================================================================
// PROGRESS BAR COMPONENT
// =============================================================================

interface ProgressBarProps {
  progress: number;
  max?: number;
  showPercentage?: boolean;
  gradient?: boolean;
  height?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * ProgressBar - Animated progress bar with spring physics and optional gradient shimmer.
 * Fully accessible with proper ARIA attributes.
 * Progress value clamps between 0 and max.
 */
export function ProgressBar({
  progress,
  max = 100,
  showPercentage = false,
  gradient = false,
  height = 8,
  className,
  ariaLabel = "Progress",
}: ProgressBarProps) {
  const shouldReduceMotion = useReducedMotion();
  const percentage = Math.min(100, Math.max(0, (progress / max) * 100));

  return (
    <div className={className} role="region" aria-label={ariaLabel}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel}
        style={{
          width: "100%",
          height,
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          borderRadius: height / 2,
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={shouldReduceMotion ? { duration: 0 } : SPRING_GENTLE}
          style={{
            height: "100%",
            borderRadius: height / 2,
            background: gradient
              ? "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%)"
              : "#3b82f6",
            backgroundSize: gradient ? "200% 100%" : undefined,
          }}
        >
          {gradient && !shouldReduceMotion && (
            <motion.div
              style={{
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
              animate={{
                backgroundPosition: ["200% 0%", "-200% 0%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          )}
        </motion.div>
      </div>
      {showPercentage && (
        <span
          style={{
            display: "block",
            marginTop: 8,
            fontSize: 14,
            color: "rgba(0, 0, 0, 0.6)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

// =============================================================================
// STAGGER CONTAINER COMPONENT
// =============================================================================

interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  staggerDelay?: number;
  delayChildren?: number;
}

/**
 * StaggerContainer - A motion.div wrapper that applies stagger animation to children.
 * Children should use motion components with the appropriate variants.
 * Simplifies the orchestration of list/grid reveals.
 */
export function StaggerContainer({
  children,
  staggerDelay = 0.1,
  delayChildren = 0.05,
  className,
  ...props
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// FADE IN VIEW COMPONENT (SCROLL TRIGGER)
// =============================================================================

interface FadeInViewProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

/**
 * FadeInView - A component that fades in when it enters the viewport.
 * Supports directional entry animations and configurable delay.
 * Uses whileInView for scroll-triggered reveals.
 */
export function FadeInView({
  children,
  delay = 0,
  direction = "up",
  distance = 20,
  className,
  ...props
}: FadeInViewProps) {
  const shouldReduceMotion = useReducedMotion();

  const getDirectionOffset = () => {
    if (direction === "none" || shouldReduceMotion) return { x: 0, y: 0 };

    switch (direction) {
      case "up":
        return { x: 0, y: distance };
      case "down":
        return { x: 0, y: -distance };
      case "left":
        return { x: distance, y: 0 };
      case "right":
        return { x: -distance, y: 0 };
      default:
        return { x: 0, y: distance };
    }
  };

  const offset = getDirectionOffset();

  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        ...SPRING_CONFIG,
        delay,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// ANIMATED COUNTER
// =============================================================================

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * AnimatedCounter - A number that animates from 0 to target value.
 * Uses spring physics for a premium counting effect.
 * Respects prefers-reduced-motion by showing final value immediately.
 */
export function AnimatedCounter({
  value,
  duration = 1,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(easeOut * value);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration, shouldReduceMotion]);

  const formattedValue = decimals > 0
    ? displayValue.toFixed(decimals)
    : Math.round(displayValue).toString();

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

/**
 * Easing curve for CSS transitions matching the spring physics feel.
 * Use with CSS transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)
 */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Standard transition duration in seconds.
 */
export const TRANSITION_DURATION = 0.3;

/**
 * Helper to create reduced-motion-safe transition objects.
 */
export function createTransition(
  shouldReduceMotion: boolean | null,
  transition: Transition
): Transition {
  if (shouldReduceMotion) {
    return { duration: 0 };
  }
  return transition;
}

export default {
  // Provider
  MotionProvider,
  useMotionContext,

  // Variants
  staggerContainer,
  fadeUpItem,
  scaleInItem,
  slideInLeft,
  slideInRight,
  fadeVariant,

  // Components
  PageTransition,
  AnimatedStep,
  Pulse,
  ProgressBar,
  StaggerContainer,
  FadeInView,
  AnimatedCounter,

  // Constants
  SPRING_CONFIG,
  SPRING_GENTLE,
  SPRING_SNAPPY,
  EASE_OUT_EXPO,
  TRANSITION_DURATION,
  createTransition,
};
