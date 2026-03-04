"use client";

import { ElementType, ReactNode, ComponentPropsWithoutRef } from "react";
import { motion } from "framer-motion";

export type ContainerSize = "compact" | "default" | "generous";

export interface ContainerProps<T extends ElementType = "div"> {
  children: ReactNode;
  size?: ContainerSize;
  className?: string;
  as?: T;
  hoverLift?: boolean;
}

type PolymorphicContainerProps<T extends ElementType> = ContainerProps<T> &
  Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "size" | "className">;

const sizePadding: Record<ContainerSize, string> = {
  compact: "p-6",
  default: "p-8",
  generous: "p-10",
};

const baseContainerClasses = [
  "relative",
  "bg-white/70",
  "backdrop-blur-xl",
  "rounded-[2.5rem]",
  "border",
  "border-white/10",
  "shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]",
  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]",
].join(" ");

export function Container<T extends ElementType = "div">({
  children,
  size = "default",
  className = "",
  as,
  hoverLift = false,
  ...props
}: PolymorphicContainerProps<T>) {
  const Component = as || "div";

  const classes = [
    baseContainerClasses,
    sizePadding[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (hoverLift) {
    return (
      <motion.div
        className={classes}
        whileHover={{
          y: -4,
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.1)",
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20,
        }}
      >
        <Component {...(props as ComponentPropsWithoutRef<T>)}>{children}</Component>
      </motion.div>
    );
  }

  return (
    <Component className={classes} {...(props as ComponentPropsWithoutRef<T>)}>
      {children}
    </Component>
  );
}
