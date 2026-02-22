import React, { ElementType, ReactNode } from "react";
import "../../styles/components/spiky-panel.css";

interface SpikyPanelProps {
  children: ReactNode;
  className?: string;
  elementType?: ElementType;
}

export default function SpikyPanel({
  children,
  className = "",
  elementType: Component = "div",
}: SpikyPanelProps) {
  return (
    <Component className={`spiky-panel-wrapper ${className}`}>
      {/* Glazed background block */}
      <div className="spiky-panel-glass" />

      {/* Main content wrapper */}
      <div className="spiky-panel-content">{children}</div>
    </Component>
  );
}
