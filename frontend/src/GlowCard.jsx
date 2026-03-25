import React from "react";

const GLOW_MAP = {
  blue: {
    edge: "rgba(126, 166, 255, 0.34)",
    fill: "rgba(126, 166, 255, 0.12)",
  },
  purple: {
    edge: "rgba(186, 156, 255, 0.34)",
    fill: "rgba(186, 156, 255, 0.12)",
  },
  green: {
    edge: "rgba(110, 231, 183, 0.34)",
    fill: "rgba(110, 231, 183, 0.12)",
  },
  red: {
    edge: "rgba(251, 113, 133, 0.34)",
    fill: "rgba(251, 113, 133, 0.12)",
  },
  orange: {
    edge: "rgba(244, 207, 102, 0.34)",
    fill: "rgba(244, 207, 102, 0.12)",
  },
};

export function GlowCard({
  children,
  glowColor = "blue",
  radius = 999,
  style,
}) {
  const colors = GLOW_MAP[glowColor] || GLOW_MAP.blue;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: radius,
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -4,
          borderRadius: radius,
          pointerEvents: "none",
          background: `radial-gradient(60% 110% at 50% 50%, ${colors.edge} 0%, transparent 70%)`,
          opacity: 0.7,
          filter: "blur(10px)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          padding: 1,
          pointerEvents: "none",
          background: `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, ${colors.edge} 40%, transparent 100%)`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          pointerEvents: "none",
          background: `radial-gradient(62% 120% at 50% 50%, ${colors.fill} 0%, transparent 72%)`,
          opacity: 0.6,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
