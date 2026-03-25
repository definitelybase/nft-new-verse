import React from "react";
import { useThemeMode } from "./ThemeModeContext";

const DARK_TONES = {
  default: {
    outer: "linear-gradient(180deg, rgba(72,76,92,0.88) 0%, rgba(180,183,201,0.72) 100%)",
    inner: "linear-gradient(180deg, rgba(243,240,250,0.16) 0%, rgba(88,91,109,0.84) 48%, rgba(232,228,242,0.1) 100%)",
    button: "linear-gradient(180deg, rgba(166,169,188,0.82) 0%, rgba(92,96,116,0.9) 100%)",
    text: "#F7F5FB",
    textShadow: "0 -1px 0 rgba(86, 82, 108, 0.68)",
    glow: "rgba(194, 185, 226, 0.06)",
  },
  accent: {
    outer: "linear-gradient(180deg, rgba(108,104,136,0.84) 0%, rgba(212,204,238,0.74) 100%)",
    inner: "linear-gradient(180deg, rgba(251,248,255,0.18) 0%, rgba(103,97,132,0.82) 48%, rgba(240,233,255,0.1) 100%)",
    button: "linear-gradient(180deg, rgba(203,195,232,0.84) 0%, rgba(116,110,150,0.9) 100%)",
    text: "#FCFAFF",
    textShadow: "0 -1px 0 rgba(92, 83, 126, 0.66)",
    glow: "rgba(196, 180, 244, 0.08)",
  },
  purple: {
    outer: "linear-gradient(180deg, rgba(125,108,164,0.84) 0%, rgba(218,204,248,0.72) 100%)",
    inner: "linear-gradient(180deg, rgba(251,245,255,0.16) 0%, rgba(110,91,148,0.82) 48%, rgba(237,229,252,0.08) 100%)",
    button: "linear-gradient(180deg, rgba(209,195,240,0.84) 0%, rgba(124,102,168,0.9) 100%)",
    text: "#FDF9FF",
    textShadow: "0 -1px 0 rgba(96, 77, 132, 0.64)",
    glow: "rgba(197, 172, 247, 0.08)",
  },
  ghost: {
    outer: "linear-gradient(180deg, rgba(80,84,100,0.72) 0%, rgba(176,180,198,0.54) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(69,72,88,0.78) 48%, rgba(215,218,229,0.06) 100%)",
    button: "linear-gradient(180deg, rgba(148,152,171,0.72) 0%, rgba(77,81,97,0.86) 100%)",
    text: "var(--shell-text)",
    textShadow: "0 -1px 0 rgba(72, 74, 90, 0.56)",
    glow: "rgba(191, 187, 209, 0.04)",
  },
  green: {
    outer: "linear-gradient(180deg, rgba(100,152,132,0.8) 0%, rgba(197,232,218,0.66) 100%)",
    inner: "linear-gradient(180deg, rgba(245,255,250,0.14) 0%, rgba(92,136,119,0.8) 48%, rgba(228,248,239,0.08) 100%)",
    button: "linear-gradient(180deg, rgba(184,226,208,0.82) 0%, rgba(103,154,133,0.88) 100%)",
    text: "#F7FFFB",
    textShadow: "0 -1px 0 rgba(74, 118, 99, 0.62)",
    glow: "rgba(154, 228, 196, 0.06)",
  },
  yellow: {
    outer: "linear-gradient(180deg, rgba(170,146,95,0.82) 0%, rgba(238,224,182,0.68) 100%)",
    inner: "linear-gradient(180deg, rgba(255,252,240,0.16) 0%, rgba(151,128,83,0.82) 48%, rgba(247,238,210,0.08) 100%)",
    button: "linear-gradient(180deg, rgba(234,221,181,0.84) 0%, rgba(168,145,98,0.88) 100%)",
    text: "#FFFDF4",
    textShadow: "0 -1px 0 rgba(132, 111, 69, 0.6)",
    glow: "rgba(232, 207, 149, 0.06)",
  },
  red: {
    outer: "linear-gradient(180deg, rgba(164,111,132,0.8) 0%, rgba(238,208,219,0.66) 100%)",
    inner: "linear-gradient(180deg, rgba(255,246,248,0.14) 0%, rgba(145,97,115,0.82) 48%, rgba(247,229,236,0.08) 100%)",
    button: "linear-gradient(180deg, rgba(232,198,210,0.84) 0%, rgba(163,110,129,0.88) 100%)",
    text: "#FFF9FB",
    textShadow: "0 -1px 0 rgba(130, 86, 103, 0.6)",
    glow: "rgba(233, 188, 205, 0.06)",
  },
};

const LIGHT_TONES = {
  default: {
    outer: "linear-gradient(180deg, rgba(198,197,214,0.88) 0%, rgba(255,255,255,0.98) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(232,228,243,0.94) 48%, rgba(251,250,255,0.94) 100%)",
    button: "linear-gradient(180deg, rgba(249,247,252,0.98) 0%, rgba(214,210,226,0.98) 100%)",
    text: "#2B2A39",
    textShadow: "0 1px 0 rgba(255,255,255,0.82)",
    glow: "rgba(186, 179, 214, 0.1)",
  },
  accent: {
    outer: "linear-gradient(180deg, rgba(188,179,222,0.9) 0%, rgba(255,255,255,0.99) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(234,226,248,0.96) 48%, rgba(252,249,255,0.94) 100%)",
    button: "linear-gradient(180deg, rgba(252,249,255,0.99) 0%, rgba(222,212,242,0.98) 100%)",
    text: "#3A2E57",
    textShadow: "0 1px 0 rgba(255,255,255,0.84)",
    glow: "rgba(183, 164, 228, 0.12)",
  },
  purple: {
    outer: "linear-gradient(180deg, rgba(201,184,233,0.9) 0%, rgba(254,248,255,0.98) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(239,228,249,0.96) 48%, rgba(252,246,255,0.95) 100%)",
    button: "linear-gradient(180deg, rgba(252,246,255,0.98) 0%, rgba(221,204,241,0.98) 100%)",
    text: "#593F82",
    textShadow: "0 1px 0 rgba(255,255,255,0.84)",
    glow: "rgba(194, 171, 243, 0.12)",
  },
  ghost: {
    outer: "linear-gradient(180deg, rgba(191,191,208,0.72) 0%, rgba(247,247,252,0.96) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(234,231,243,0.9) 48%, rgba(249,248,253,0.92) 100%)",
    button: "linear-gradient(180deg, rgba(246,245,250,0.96) 0%, rgba(220,216,230,0.96) 100%)",
    text: "var(--shell-text)",
    textShadow: "0 1px 0 rgba(255,255,255,0.82)",
    glow: "rgba(194, 186, 218, 0.1)",
  },
  green: {
    outer: "linear-gradient(180deg, rgba(167,209,190,0.9) 0%, rgba(248,255,251,0.98) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(228,244,236,0.95) 48%, rgba(246,255,250,0.95) 100%)",
    button: "linear-gradient(180deg, rgba(248,255,252,0.98) 0%, rgba(206,232,219,0.98) 100%)",
    text: "#447467",
    textShadow: "0 1px 0 rgba(255,255,255,0.82)",
    glow: "rgba(173, 227, 203, 0.1)",
  },
  yellow: {
    outer: "linear-gradient(180deg, rgba(224,205,164,0.9) 0%, rgba(255,252,243,0.99) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,238,216,0.96) 48%, rgba(255,251,239,0.95) 100%)",
    button: "linear-gradient(180deg, rgba(255,252,242,0.99) 0%, rgba(238,224,186,0.98) 100%)",
    text: "#8A7340",
    textShadow: "0 1px 0 rgba(255,255,255,0.84)",
    glow: "rgba(233, 214, 170, 0.1)",
  },
  red: {
    outer: "linear-gradient(180deg, rgba(220,182,194,0.9) 0%, rgba(255,247,250,0.98) 100%)",
    inner: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,229,235,0.95) 48%, rgba(255,244,247,0.95) 100%)",
    button: "linear-gradient(180deg, rgba(255,247,249,0.99) 0%, rgba(239,212,220,0.98) 100%)",
    text: "#8B5968",
    textShadow: "0 1px 0 rgba(255,255,255,0.84)",
    glow: "rgba(234, 196, 208, 0.1)",
  },
};

const SIZES = {
  xs: { height: 30, padding: "0 10px", fontSize: 10, gap: 6 },
  sm: { height: 36, padding: "0 13px", fontSize: 10.5, gap: 6 },
  md: { height: 42, padding: "0 16px", fontSize: 11, gap: 7 },
  lg: { height: 46, padding: "0 20px", fontSize: 12, gap: 8 },
};

function getRadius(shape) {
  return shape === "soft" ? 14 : 999;
}

export const MetalButton = React.forwardRef(function MetalButton(
  {
    children,
    tone = "default",
    size = "md",
    active = false,
    block = false,
    shape = "pill",
    hoverLift = true,
    contentStyle,
    style,
    disabled = false,
    type = "button",
    ...props
  },
  ref
) {
  const themeMode = useThemeMode();
  const toneMap = themeMode === "light" ? LIGHT_TONES : DARK_TONES;
  const colors = toneMap[tone] || toneMap.default;
  const sizing = SIZES[size] || SIZES.md;
  const radius = getRadius(shape);
  const baseShadow = active
    ? `0 3px 10px rgba(0,0,0,0.10), 0 0 0 1px rgba(255,255,255,0.02), 0 0 10px ${colors.glow}`
    : "0 2px 6px rgba(0,0,0,0.07)";

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: block ? "100%" : undefined,
        minHeight: sizing.height,
        height: sizing.height,
        padding: 1.25,
        border: "none",
        borderRadius: radius + 2,
        background: colors.outer,
        boxShadow: baseShadow,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.48 : 1,
        transition: "transform 200ms cubic-bezier(0.1, 0.4, 0.2, 1), box-shadow 200ms ease, opacity 160ms ease",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      onMouseEnter={(event) => {
        if (disabled || !hoverLift) return;
        event.currentTarget.style.transform = "translateY(-1px)";
        event.currentTarget.style.boxShadow = active
          ? `0 4px 10px rgba(0,0,0,0.10), 0 0 10px ${colors.glow}`
          : "0 4px 8px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(event) => {
        if (disabled || !hoverLift) return;
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow = baseShadow;
      }}
      onMouseDown={(event) => {
        if (disabled || !hoverLift) return;
        event.currentTarget.style.transform = "translateY(1px) scale(0.995)";
      }}
      onMouseUp={(event) => {
        if (disabled || !hoverLift) return;
        event.currentTarget.style.transform = "translateY(-1px)";
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 1,
          borderRadius: radius + 1,
          background: colors.inner,
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 2,
          borderRadius: radius,
          background: colors.button,
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: "2px 2px auto 2px",
          height: "48%",
          borderRadius: radius,
          background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 100%)",
          opacity: active ? 0.82 : 0.62,
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: sizing.gap,
          width: block ? "100%" : undefined,
          height: sizing.height - 4,
          padding: sizing.padding,
          color: colors.text,
          fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
          fontSize: sizing.fontSize,
          fontWeight: 700,
          letterSpacing: 0.46,
          lineHeight: 1,
          textShadow: colors.textShadow,
          whiteSpace: "nowrap",
          ...contentStyle,
        }}
      >
        {children}
      </span>
    </button>
  );
});

MetalButton.displayName = "MetalButton";
