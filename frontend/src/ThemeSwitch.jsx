import React from "react";

const SIZE_MAP = {
  sm: { width: 54, height: 28, pad: 3, thumb: 22, icon: 10 },
  md: { width: 62, height: 32, pad: 3, thumb: 26, icon: 12 },
  lg: { width: 70, height: 36, pad: 4, thumb: 28, icon: 13 },
};

export function ThemeSwitch({
  themeMode = "dark",
  onToggle,
  size = "md",
  style,
  title,
}) {
  const sizing = SIZE_MAP[size] || SIZE_MAP.md;
  const isLight = themeMode === "light";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={title || `Switch to ${isLight ? "dark" : "light"} mode`}
      aria-label={title || `Switch to ${isLight ? "dark" : "light"} mode`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: sizing.width,
        height: sizing.height,
        padding: sizing.pad,
        borderRadius: 999,
        border: "1px solid var(--shell-border-strong)",
        background: isLight
          ? "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(223,228,238,0.92) 100%)"
          : "linear-gradient(180deg, rgba(56,61,74,0.72) 0%, rgba(27,30,38,0.88) 100%)",
        boxShadow: isLight
          ? "inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 22px rgba(92, 99, 122, 0.14)"
          : "inset 0 1px 0 rgba(255,255,255,0.14), 0 12px 24px rgba(0,0,0,0.22)",
        cursor: "pointer",
        backdropFilter: "blur(14px)",
        transition: "background 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: isLight ? sizing.width - sizing.pad - sizing.thumb : sizing.pad,
          top: sizing.pad,
          width: sizing.thumb,
          height: sizing.thumb,
          borderRadius: "50%",
          background: isLight
            ? "linear-gradient(180deg, #ffffff 0%, #ecf0f7 100%)"
            : "linear-gradient(180deg, #f6f7fb 0%, #dfe5f2 100%)",
          boxShadow: isLight
            ? "0 6px 14px rgba(108, 118, 145, 0.2), inset 0 1px 0 rgba(255,255,255,0.9)"
            : "0 6px 14px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255,255,255,0.7)",
          transition: "left 220ms cubic-bezier(0.22, 1, 0.36, 1), background 220ms ease",
        }}
      />

      <span
        aria-hidden
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 6px",
          position: "relative",
          zIndex: 1,
          color: isLight ? "#7F899D" : "#C9D0E1",
          fontSize: sizing.icon,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        <span style={{ opacity: isLight ? 0.42 : 0.96 }}>☾</span>
        <span style={{ opacity: isLight ? 0.96 : 0.42 }}>☼</span>
      </span>
    </button>
  );
}
