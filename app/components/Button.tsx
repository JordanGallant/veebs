"use client";

import { forwardRef, ReactNode } from "react";
import { motion } from "framer-motion";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "default" | "small" | "large";

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  liquidGlass?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  form?: string;
  name?: string;
  value?: string | ReadonlyArray<string> | number;
  title?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-expanded"?: boolean | "true" | "false";
  "aria-haspopup"?: boolean | "true" | "false" | "menu" | "listbox" | "tree" | "grid" | "dialog";
}

const baseClasses =
  "relative inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-zinc-950 text-white hover:bg-zinc-800",
  secondary: "bg-transparent border border-zinc-200 text-zinc-950 hover:bg-zinc-50",
};

const liquidGlassClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-white/20",
    "backdrop-blur-xl",
    "border",
    "border-white/20",
    "text-zinc-950",
    "hover:bg-white/30",
    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]",
  ].join(" "),
  secondary: [
    "bg-white/10",
    "backdrop-blur-xl",
    "border",
    "border-white/10",
    "text-zinc-950",
    "hover:bg-white/20",
    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]",
  ].join(" "),
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-6 py-3 text-base gap-2 rounded-2xl",
  small: "px-4 py-2 text-sm gap-1.5 rounded-xl",
  large: "px-8 py-4 text-lg gap-2.5 rounded-3xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "default",
      liquidGlass = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = [
      baseClasses,
      liquidGlass ? liquidGlassClasses[variant] : variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <motion.button
        ref={ref}
        className={classes}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20,
        }}
        {...props}
      >
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
