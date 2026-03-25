import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { PIXEL_ROUTER_ABI, ERC721_ABI, PIXEL_POOL_ABI } from "./pixelRouterAbi";
import usePoolData from "./usePoolData";
import { GlowCard } from "./GlowCard";
import { MetalButton } from "./MetalButton";
import { ThemeSwitch } from "./ThemeSwitch";

const COLORS = {
  bg: "var(--ocp-bg)",
  surface: "var(--ocp-surface)",
  surfaceStrong: "var(--ocp-surface-strong)",
  border: "var(--ocp-border)",
  borderStrong: "var(--ocp-border-strong)",
  text: "var(--ocp-text)",
  textMuted: "var(--ocp-text-muted)",
  textDim: "var(--ocp-text-dim)",
  accent: "var(--ocp-accent)",
  accentSoft: "var(--ocp-accent-soft)",
  green: "var(--ocp-green)",
  greenSoft: "var(--ocp-green-soft)",
  yellow: "var(--ocp-yellow)",
  yellowSoft: "var(--ocp-yellow-soft)",
  purple: "var(--ocp-purple)",
  purpleSoft: "var(--ocp-purple-soft)",
  red: "var(--ocp-red)",
  redSoft: "var(--ocp-red-soft)",
};

const fonts = `'IBM Plex Mono', 'JetBrains Mono', monospace`;
const fontDisplay = `'Space Grotesk', 'Satoshi', 'Syne', sans-serif`;
const MINT_PAYLOAD_STORAGE_KEY = "onchainpixel.mintPayload";
const MINT_TARGET_SUPPLY = 10000;
const DEFAULT_PREVIEW_PALETTE = [
  "#000000", "#ffffff", "#ff0000", "#00ff00",
  "#0066ff", "#ffcc00", "#ff6600", "#9933ff",
  "#00cccc", "#ff3399", "#336633", "#663300",
  "#cccccc", "#666666", "#ffccaa", "#3399ff",
];

// Fallback data when pool is not connected — clearly marked as preview
const MOCK_POOL = {
  ethBalance: 0,
  floor: 0,
  sellPrice: 0,
  buyPrice: 0,
  totalMinted: 0,
  totalStaked: 0,
  poolNfts: 0,
  circulating: 0,
  emc: 0,
  liqRatio: 0,
  protocolFees: 0,
  treasuryBalance: 0,
  marketState: null,
  canSell: false,
  canBuy: false,
  ethUsd: 2000,
  mintPriceEth: null,
  dailyVolume: null,
  trades24h: null,
};


function shortAddress(value) {
  if (!value) return "Connect wallet";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatEth(value, digits = 4) {
  if (!value) return null;
  try {
    return `${Number(ethers.utils.formatEther(value)).toFixed(digits)} ETH`;
  } catch {
    return null;
  }
}

function summarizeTokenIds(ids) {
  if (!ids?.length) return "None staked";
  const preview = ids.slice(0, 4).join(", ");
  return ids.length <= 4 ? `IDs: ${preview}` : `${preview} +${ids.length - 4}`;
}

function TokenGrid({ title, tokens, selectedTokenId, onSelect, emptyLabel, loading, tone = "accent" }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 10 }}>
        {title}
      </div>
      {loading ? (
        <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.7 }}>
          Loading NFTs...
        </div>
      ) : tokens.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
            gap: 10,
            maxHeight: 220,
            overflowY: "auto",
            paddingRight: 2,
          }}
        >
          {tokens.map((tokenId) => {
            const selected = selectedTokenId === tokenId;
            const toneMap = {
              accent: { bg: COLORS.accentSoft, text: COLORS.accent },
              purple: { bg: COLORS.purpleSoft, text: COLORS.purple },
              red: { bg: COLORS.redSoft, text: COLORS.red },
              green: { bg: COLORS.greenSoft, text: COLORS.green },
            };
            const colors = toneMap[tone] || toneMap.accent;

            return (
              <button
                key={tokenId}
                type="button"
                onClick={() => onSelect(tokenId)}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 18,
                  border: `1px solid ${selected ? COLORS.borderStrong : COLORS.border}`,
                  background: selected ? colors.bg : COLORS.surfaceStrong,
                  color: selected ? colors.text : COLORS.text,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "transform 180ms ease, border-color 180ms ease, background 180ms ease",
                  fontFamily: fonts,
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span style={{ fontSize: 10, letterSpacing: 1, color: selected ? colors.text : COLORS.textDim }}>
                  NFT
                </span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>#{tokenId}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.7 }}>
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function readStoredMintPayload() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(MINT_PAYLOAD_STORAGE_KEY) || "";
}

function isValidMintPayload(payloadHex) {
  if (!payloadHex || !ethers.utils.isHexString(payloadHex)) return false;
  return ethers.utils.hexDataLength(payloadHex) === 512;
}

function revealStyle(delay = 0) {
  return { animationDelay: `${delay}ms` };
}

function driftStyle(delay = 0, duration = 8) {
  return {
    animationDelay: `${delay}ms`,
    animationDuration: `${duration}s`,
  };
}

function SiteMotionStyles() {
  return (
    <style>{`
      .site-reveal {
        opacity: 0;
        transform: translateY(22px);
        animation: siteFadeUp 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      .site-reveal-soft {
        opacity: 0;
        transform: translateY(14px);
        animation: siteFadeUpSoft 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      .site-nav-enter {
        opacity: 0;
        transform: translateY(-16px);
        animation: siteNavIn 820ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards;
      }

      .site-drift {
        animation: siteDrift 14s ease-in-out infinite;
        will-change: transform;
      }

      .site-pulse-glow {
        opacity: 0.86;
      }

      .site-hover-lift {
        transition: transform 220ms ease, border-color 220ms ease, background 220ms ease, box-shadow 220ms ease;
      }

      .site-hover-lift:hover {
        transform: translateY(-4px);
        box-shadow: 0 14px 28px rgba(0, 0, 0, 0.16);
      }

      @keyframes siteFadeUp {
        from { opacity: 0; transform: translateY(22px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes siteFadeUpSoft {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes siteNavIn {
        from { opacity: 0; transform: translateY(-16px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes siteDrift {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
        100% { transform: translateY(0px); }
      }

      @media (prefers-reduced-motion: reduce) {
        .site-reveal,
        .site-reveal-soft,
        .site-nav-enter,
        .site-drift,
        .site-pulse-glow {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `}</style>
  );
}

function FrostCard({ children, style, hoverable = false, className = "" }) {
  const baseStyle = {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 28,
    backdropFilter: "blur(4px)",
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.16)",
    transition: "transform 0.2s, border-color 0.2s, background 0.2s",
    minWidth: 0,
    overflow: "hidden",
    ...style,
  };

  return (
    <div
      className={className}
      style={baseStyle}
      onMouseEnter={hoverable ? (event) => {
        event.currentTarget.style.borderColor = COLORS.borderStrong;
        event.currentTarget.style.transform = "translateY(-2px)";
      } : undefined}
      onMouseLeave={hoverable ? (event) => {
        event.currentTarget.style.borderColor = COLORS.border;
        event.currentTarget.style.transform = "translateY(0)";
      } : undefined}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, tone = "accent" }) {
  const tones = {
    accent: { color: COLORS.accent, background: COLORS.accentSoft },
    green: { color: COLORS.green, background: COLORS.greenSoft },
    yellow: { color: COLORS.yellow, background: COLORS.yellowSoft },
    purple: { color: COLORS.purple, background: COLORS.purpleSoft },
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: tones[tone].background,
        color: tones[tone].color,
        border: `1px solid ${COLORS.border}`,
        fontFamily: fonts,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function PixelAvatar({ size = 48, seed = 0 }) {
  const grid = 8;
  const px = size / grid;
  const colors = ["#2A1506", "#E8B87A", "#D4A56A", "#3368BB", "#5B8EC9", "#C44040", "#FFF", "#3B6B35", "#000", "#22C55E", "#8B5CF6", "#FFD700"];
  const rng = (s) => {
    let h = s | 0;
    return () => {
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
      h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
  };
  const r = rng(seed * 7919 + 1);
  const bg = colors[Math.floor(r() * 3) + 3];
  const skin = colors[Math.floor(r() * 2) + 1];
  const hair = colors[Math.floor(r() * 3)];
  const shirt = colors[Math.floor(r() * 4) + 3];
  const eyeC = colors[Math.floor(r() * 3) + 7];

  const map = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      let c = bg;
      if (y >= 0 && y <= 1 && x >= 2 && x <= 5) c = hair;
      if (y === 2 && x >= 1 && x <= 6) c = skin;
      if (y === 3 && x >= 1 && x <= 6) {
        c = skin;
        if (x === 2 || x === 5) c = "#FFF";
        if (x === 3 || x === 6) c = eyeC;
      }
      if (y === 4 && x >= 1 && x <= 6) {
        c = skin;
        if (x === 3 || x === 4) c = "#D4A56A";
      }
      if (y === 5 && x >= 2 && x <= 5) {
        c = skin;
        if (x === 3 || x === 4) c = "#C44040";
      }
      if (y >= 6 && x >= 1 && x <= 6) c = shirt;
      map.push({ x: x * px, y: y * px, c });
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 8, imageRendering: "pixelated" }}>
      {map.map((pixel, index) => (
        <rect key={index} x={pixel.x} y={pixel.y} width={px} height={px} fill={pixel.c} />
      ))}
    </svg>
  );
}

function FeaturedMintArtwork({ size = 320 }) {
  const pink = "#ff2aa6";
  const purple = "#6f1b72";
  const teal = "#63f0d6";
  const yellow = "#fff074";
  const black = "#17181f";
  const shadow = "#111218";

  const pixels = [
    [4, 1, pink], [5, 1, pink], [8, 1, pink], [9, 1, pink], [12, 1, pink], [13, 1, pink],
    [4, 2, pink], [5, 2, pink], [6, 2, pink], [8, 2, pink], [9, 2, pink], [10, 2, pink], [12, 2, pink], [13, 2, pink], [14, 2, pink],
    [5, 3, pink], [6, 3, pink], [7, 3, pink], [8, 3, pink], [10, 3, pink], [11, 3, pink], [12, 3, pink], [13, 3, pink], [14, 3, pink],
    [2, 4, pink], [3, 4, pink], [4, 4, pink], [5, 4, pink], [6, 4, pink], [8, 4, pink], [9, 4, pink], [10, 4, pink], [11, 4, pink], [12, 4, pink], [14, 4, pink],
    [3, 5, pink], [4, 5, pink], [5, 5, pink], [6, 5, pink], [7, 5, pink], [8, 5, pink], [9, 5, pink], [10, 5, pink], [11, 5, pink], [12, 5, pink], [13, 5, pink],
    [2, 6, purple], [3, 6, purple], [4, 6, purple], [5, 6, purple], [6, 6, purple], [7, 6, purple], [8, 6, purple], [9, 6, purple], [10, 6, purple], [11, 6, purple], [12, 6, purple], [13, 6, purple], [14, 6, purple], [15, 6, purple],
    [4, 7, purple], [5, 7, purple], [6, 7, teal], [7, 7, teal], [8, 7, teal], [9, 7, teal], [10, 7, teal], [11, 7, teal], [12, 7, teal], [13, 7, teal], [14, 7, purple], [15, 7, purple],
    [5, 8, purple], [6, 8, teal], [7, 8, teal], [8, 8, teal], [9, 8, teal], [10, 8, teal], [11, 8, teal], [12, 8, teal], [13, 8, teal], [14, 8, purple],
    [4, 10, pink], [5, 10, pink], [6, 10, pink], [7, 10, pink], [9, 10, pink], [10, 10, pink], [11, 10, pink], [12, 10, pink], [14, 10, teal], [15, 10, teal],
    [5, 11, pink], [6, 11, pink], [8, 11, teal], [9, 11, pink], [10, 11, pink], [12, 11, teal], [13, 11, teal], [14, 11, teal], [15, 11, teal],
    [5, 12, teal], [6, 12, teal], [7, 12, teal], [8, 12, teal], [9, 12, teal], [10, 12, teal], [11, 12, teal], [12, 12, teal], [13, 12, teal], [15, 12, yellow],
    [5, 13, teal], [6, 13, teal], [7, 13, shadow], [8, 13, shadow], [9, 13, teal], [10, 13, teal], [11, 13, teal], [12, 13, teal], [13, 13, shadow], [14, 13, teal],
    [5, 14, teal], [6, 14, teal], [7, 14, teal], [8, 14, teal], [9, 14, teal], [10, 14, shadow], [11, 14, pink], [12, 14, teal], [13, 14, teal],
    [5, 15, teal], [6, 15, teal], [7, 15, teal], [8, 15, teal], [9, 15, teal], [10, 15, teal], [12, 15, teal], [13, 15, shadow],
    [9, 16, teal], [10, 16, teal], [11, 16, teal], [12, 16, teal], [13, 16, teal], [14, 16, teal],
    [10, 17, teal], [11, 17, teal], [12, 17, teal], [13, 17, teal], [14, 17, teal], [15, 17, teal],
  ];

  const cell = size / 20;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      style={{
        display: "block",
        imageRendering: "pixelated",
        shapeRendering: "crispEdges",
        filter: "drop-shadow(0 20px 38px rgba(0,0,0,0.28))",
      }}
    >
      <rect width="20" height="20" fill={black} />
      <rect x="0" y="0" width="20" height="20" fill="url(#mintGlow)" />
      {pixels.map(([x, y, color], index) => (
        <rect key={index} x={x} y={y} width="1" height="1" fill={color} />
      ))}
      <defs>
        <radialGradient id="mintGlow" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function decodeMintPayloadGrid(payloadHex) {
  if (!isValidMintPayload(payloadHex)) return null;

  const bytes = ethers.utils.arrayify(payloadHex);
  const grid = [];
  let offset = 0;

  for (let y = 0; y < 32; y += 1) {
    const row = [];
    for (let x = 0; x < 32; x += 2) {
      const byte = bytes[offset++];
      row.push((byte >> 4) & 0x0f);
      row.push(byte & 0x0f);
    }
    grid.push(row);
  }

  return grid;
}

function hasVisiblePayloadPixels(grid) {
  if (!grid) return false;
  return grid.some((row) => row.some((value) => value !== 0));
}

function PixelPayloadPreview({ payloadHex }) {
  const decodedGrid = React.useMemo(() => decodeMintPayloadGrid(payloadHex), [payloadHex]);
  const showDecodedGrid = React.useMemo(() => hasVisiblePayloadPixels(decodedGrid), [decodedGrid]);

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 28,
        overflow: "hidden",
        border: `1px solid ${COLORS.borderStrong}`,
        background:
          showDecodedGrid
            ? "radial-gradient(circle at top left, rgba(186,156,255,0.16), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.06))"
            : "radial-gradient(circle at top left, rgba(186,156,255,0.22), transparent 30%), radial-gradient(circle at bottom right, rgba(124,183,246,0.18), transparent 34%), linear-gradient(145deg, rgba(24,27,34,0.96), rgba(14,16,22,0.98))",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      {showDecodedGrid ? (
        <svg
          viewBox="0 0 32 32"
          style={{
            width: "100%",
            height: "100%",
            maxWidth: 420,
            maxHeight: 420,
            imageRendering: "pixelated",
            shapeRendering: "crispEdges",
            borderRadius: 22,
            boxShadow: "0 18px 42px rgba(0,0,0,0.22)",
          }}
        >
          <rect width="32" height="32" fill={DEFAULT_PREVIEW_PALETTE[0]} />
          {decodedGrid.flatMap((row, y) =>
            row.map((value, x) => (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width="1"
                height="1"
                fill={DEFAULT_PREVIEW_PALETTE[value] || DEFAULT_PREVIEW_PALETTE[0]}
              />
            ))
          )}
        </svg>
      ) : (
        <div style={{ width: "100%", height: "100%", display: "grid" }}>
          <div
            style={{
              borderRadius: 24,
              border: `1px solid ${COLORS.border}`,
              background:
                "radial-gradient(circle at 50% 18%, rgba(255,255,255,0.12), transparent 20%), radial-gradient(circle at 40% 55%, rgba(255,42,166,0.12), transparent 32%), radial-gradient(circle at 60% 60%, rgba(99,240,214,0.10), transparent 36%), linear-gradient(180deg, rgba(28,30,38,0.96), rgba(14,16,22,0.98))",
              display: "grid",
              placeItems: "center",
              position: "relative",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 50% 18%, rgba(255,255,255,0.08), transparent 18%), radial-gradient(circle at 45% 36%, rgba(255,42,166,0.14), transparent 26%), radial-gradient(circle at 58% 58%, rgba(99,240,214,0.14), transparent 28%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                padding: 24,
              }}
            >
              <FeaturedMintArtwork size={420} />
            </div>
          </div>
        </div>
      )}

      {showDecodedGrid ? (
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Eyebrow tone="green">Mint-ready preview</Eyebrow>
          <Eyebrow tone="purple">Payload linked</Eyebrow>
        </div>
      ) : null}
    </div>
  );
}

function FloatingNav({ page, setPage, wallet, onConnectWallet, themeMode, onToggleTheme }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "mint", label: "Mint" },
    { id: "market", label: "Marketplace" },
    { id: "staking", label: "Staking" },
  ];

  return (
    <header
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(1120px, calc(100vw - 28px))",
        zIndex: 100,
      }}
    >
      <FrostCard
        className="site-nav-enter"
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <MetalButton
          onClick={() => setPage("home")}
          tone={page === "home" ? "accent" : "ghost"}
          active={page === "home"}
          shape="soft"
          size="md"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: 50,
            padding: "9px 12px",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: COLORS.surfaceStrong,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${COLORS.borderStrong}`,
            }}
          >
            <div style={{ width: 16, height: 16, borderRadius: 5, background: COLORS.text }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: -0.6 }}>
              OnChainPixel
            </div>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 0.7 }}>
              Fully on-chain pixel liquidity
            </div>
          </div>
        </MetalButton>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {items.map((item) => {
            const button = (
              <MetalButton
                key={item.id}
                onClick={() => setPage(item.id)}
                tone={page === item.id ? "accent" : "ghost"}
                active={page === item.id}
                size="sm"
                style={{
                  minHeight: 38,
                  padding: "9px 15px",
                }}
              >
                {item.label}
              </MetalButton>
            );

            return page === item.id ? (
              <GlowCard key={item.id} glowColor="blue" radius={999}>
                {button}
              </GlowCard>
            ) : button;
          })}
          <ThemeSwitch themeMode={themeMode} onToggle={onToggleTheme} size="sm" />
        </div>

        <MetalButton
          onClick={onConnectWallet}
          tone="accent"
          style={{
            minWidth: 154,
            minHeight: 44,
            padding: "11px 16px",
          }}
        >
          {wallet?.account ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: SUPPORTED_CHAINS.includes(wallet.chainId) ? COLORS.green : COLORS.yellow,
              }} />
              {shortAddress(wallet.account)}
            </span>
          ) : "Connect Wallet"}
        </MetalButton>
      </FrostCard>
    </header>
  );
}

function HeroGallery({ pool, isLive }) {
  const tiles = [
    { title: "Permanent art", desc: "SSTORE2-backed data", seed: 11, size: 112 },
    { title: "Live market", desc: "Pool-aware pricing", seed: 87, size: 88 },
    { title: "Instant exits", desc: "Floor-liquidity thesis", seed: 61, size: 88 },
    { title: "On-chain render", desc: "SVG output", seed: 122, size: 88 },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.05fr 0.95fr",
        gap: 12,
        minHeight: 500,
      }}
    >
      <FrostCard
        className="site-reveal"
        style={{
          padding: 30,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          position: "relative",
          ...revealStyle(80),
        }}
      >
        <div
          className="site-pulse-glow"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top right, rgba(255,255,255,0.06), transparent 28%), radial-gradient(circle at bottom left, rgba(255,255,255,0.04), transparent 30%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <Eyebrow>Protocol gallery</Eyebrow>
          <div
            style={{
              marginTop: 24,
              color: COLORS.text,
              fontFamily: fontDisplay,
              fontSize: "clamp(40px, 7vw, 78px)",
              lineHeight: 0.94,
              fontWeight: 600,
              letterSpacing: -2.6,
            }}
          >
            Pixel art.
            <br />
            Liquidity engine.
          </div>
          <p
            style={{
              margin: "22px 0 0",
              maxWidth: 500,
              color: COLORS.textMuted,
              fontFamily: fonts,
              fontSize: 13,
              lineHeight: 1.75,
            }}
          >
            A gallery-first NFT protocol where the collection, the market, and the floor
            quote all live on-chain. The interface should feel like a curated room, not a dashboard graveyard.
          </p>

        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 28,
          }}
        >
          <Eyebrow tone="green">Floor {fmtEth(pool?.floor)}</Eyebrow>
          <Eyebrow tone="yellow">{pool?.poolNfts ?? "—"} in pool</Eyebrow>
          {pool?.marketState ? <Eyebrow tone="purple">{pool.marketState}</Eyebrow> : <Eyebrow tone="purple">—</Eyebrow>}
        </div>
      </FrostCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {tiles.map((tile, index) => (
          <FrostCard
            key={tile.title}
            hoverable
            className="site-reveal site-hover-lift"
            style={{
              padding: 16,
              minHeight: 206,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              ...revealStyle(140 + index * 70),
            }}
          >
            <div style={{ display: "flex", justifyContent: index === 0 ? "center" : "flex-start" }}>
              <div className="site-drift" style={driftStyle(index * 360, 7 + index)}>
                <PixelAvatar size={tile.size} seed={tile.seed} />
              </div>
            </div>
            <div>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>
                {tile.title}
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 6, lineHeight: 1.55 }}>
                {tile.desc}
              </div>
            </div>
          </FrostCard>
        ))}
      </div>
    </div>
  );
}

function MetricPanel({ label, value, sub, tone = "text", className = "", style }) {
  const tones = {
    text: COLORS.text,
    accent: COLORS.accent,
    green: COLORS.green,
    yellow: COLORS.yellow,
    purple: COLORS.purple,
  };

  return (
    <FrostCard
      className={className}
      style={{
        padding: 20,
        minHeight: 158,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        ...style,
      }}
    >
      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, color: tones[tone], fontFamily: fontDisplay, fontSize: 30, fontWeight: 600, letterSpacing: -0.9, lineHeight: 0.96, overflowWrap: "anywhere" }}>
        {value}
      </div>
      {sub ? (
        <div style={{ marginTop: 10, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          {sub}
        </div>
      ) : null}
    </FrostCard>
  );
}

function PoolViz({ pool, className = "", style }) {
  const ethPct = Math.min((pool.ethBalance / (pool.ethBalance + 20)) * 100, 95);
  const nftPct = Math.min((pool.poolNfts / (pool.poolNfts + 200)) * 100, 95);

  return (
    <FrostCard className={className} style={{ padding: 24, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: -0.9 }}>
            Liquidity pool
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 6 }}>
            Floating reserve view inspired by gallery tiles rather than exchange widgets.
          </div>
        </div>
        <Eyebrow tone="green">Live reserve shape</Eyebrow>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "stretch" }}>
        <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 24, minHeight: 148, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ color: COLORS.accent, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" }}>ETH reserve</div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", marginTop: 14 }}>
            <div style={{ width: `${ethPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #7CB7F6, #BA9CFF)" }} />
          </div>
          <div style={{ marginTop: 12, color: COLORS.text, fontFamily: fontDisplay, fontSize: 26, fontWeight: 600 }}>
            {pool.ethBalance.toFixed(2)} ETH
          </div>
        </FrostCard>

        <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 24, minHeight: 148, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ color: COLORS.green, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" }}>Inventory depth</div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", marginTop: 14 }}>
            <div style={{ width: `${nftPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #6EE7B7, #F4CF66)" }} />
          </div>
          <div style={{ marginTop: 12, color: COLORS.text, fontFamily: fontDisplay, fontSize: 26, fontWeight: 600 }}>
            {pool.poolNfts} NFTs
          </div>
        </FrostCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14, alignItems: "stretch" }}>
        <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 24, minHeight: 108, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Sell quote</div>
          <div style={{ marginTop: 8, color: COLORS.red, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{pool.sellPrice} ETH</div>
        </FrostCard>
        <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 24, minHeight: 108, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Floor quote</div>
          <div style={{ marginTop: 8, color: COLORS.yellow, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{pool.floor} ETH</div>
        </FrostCard>
        <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 24, minHeight: 108, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Ask quote</div>
          <div style={{ marginTop: 8, color: COLORS.green, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{pool.buyPrice} ETH</div>
        </FrostCard>
      </div>
    </FrostCard>
  );
}

function LiquiditySystemOverview({ className = "", style }) {
  const splitCards = [
    { label: "Pool reserve", value: "60%", sub: "Every mint seeds floor liquidity.", tone: COLORS.accent },
    { label: "Treasury lane", value: "10%", sub: "Buyback and burn pressure valve.", tone: COLORS.purple },
    { label: "Protocol ops", value: "30%", sub: "Funds rollout, maintenance and collection support.", tone: COLORS.yellow },
    { label: "Staker fees", value: "5 / 5%", sub: "From each buy and sell, paid to stakers.", tone: COLORS.green },
  ];

  const zones = [
    { label: "Expansion", color: "rgba(124, 183, 246, 0.12)", border: "rgba(124,183,246,0.22)" },
    { label: "Stabilization", color: "rgba(186, 156, 255, 0.12)", border: "rgba(186,156,255,0.22)" },
    { label: "Weak demand", color: "rgba(244, 207, 102, 0.12)", border: "rgba(244,207,102,0.22)" },
  ];

  return (
    <FrostCard className={className} style={{ padding: 24, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: -0.9 }}>
            How liquidity works
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 6, lineHeight: 1.7, maxWidth: 560 }}>
            The home page should explain the mechanism first: mints seed the reserve, the pool quotes the floor, treasury absorbs weak demand, and premium pricing stays with the market.
          </div>
        </div>
        <Eyebrow tone="purple">Protocol flow</Eyebrow>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "stretch" }}>
        {splitCards.map((item) => (
          <FrostCard key={item.label} style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 24, minHeight: 164, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              {item.label}
            </div>
            <div style={{ marginTop: 10, color: item.tone, fontFamily: fontDisplay, fontSize: 28, fontWeight: 600 }}>
              {item.value}
            </div>
            <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.6 }}>
              {item.sub}
            </div>
          </FrostCard>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 14, marginTop: 16, alignItems: "stretch" }}>
        <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 24, display: "flex", flexDirection: "column", minHeight: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Market-state curve
            </div>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              Demand vs protocol behavior
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {zones.map((zone) => (
              <div
                key={zone.label}
                style={{
                  padding: "9px 12px",
                  borderRadius: 999,
                  border: `1px solid ${zone.border}`,
                  background: zone.color,
                  color: COLORS.text,
                  fontFamily: fonts,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                {zone.label}
              </div>
            ))}
          </div>

          <div
            style={{
              borderRadius: 20,
              overflow: "hidden",
              border: `1px solid ${COLORS.border}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.03))",
              flex: 1,
              display: "flex",
              minHeight: 360,
            }}
          >
            <svg viewBox="0 0 920 420" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="floorLine" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#7CB7F6" />
                  <stop offset="55%" stopColor="#BA9CFF" />
                  <stop offset="100%" stopColor="#F4CF66" />
                </linearGradient>
                <linearGradient id="quoteLane" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.36)" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="306.7" height="420" fill="rgba(124,183,246,0.06)" />
              <rect x="306.7" y="0" width="306.7" height="420" fill="rgba(186,156,255,0.06)" />
              <rect x="613.4" y="0" width="306.6" height="420" fill="rgba(244,207,102,0.06)" />

              {[86, 168, 250, 332].map((y) => (
                <line key={y} x1="46" y1={y} x2="872" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
              ))}
              {[306.7, 613.4].map((x) => (
                <line key={x} x1={x} y1="36" x2={x} y2="366" stroke="rgba(255,255,255,0.09)" strokeDasharray="8 11" strokeWidth="1.5" />
              ))}

              <path
                d="M60 276 C140 270, 210 248, 288 214 C350 188, 420 166, 520 156 C610 148, 700 158, 860 220"
                fill="none"
                stroke="url(#floorLine)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M60 216 C154 208, 236 178, 320 138 C406 98, 522 82, 654 92 C742 100, 810 126, 860 160"
                fill="none"
                stroke="url(#quoteLane)"
                strokeWidth="7"
                strokeDasharray="16 12"
                strokeLinecap="round"
              />
              <path
                d="M60 332 C152 326, 254 318, 360 304 C470 292, 596 286, 694 288 C778 290, 832 298, 860 306"
                fill="none"
                stroke="rgba(110,231,183,0.3)"
                strokeWidth="6"
                strokeDasharray="10 14"
                strokeLinecap="round"
              />

              <circle cx="232" cy="234" r="13" fill="#7CB7F6" />
              <circle cx="316" cy="202" r="13" fill="#BA9CFF" />
              <circle cx="610" cy="158" r="13" fill="#F4CF66" />

              <text x="74" y="52" fill="rgba(255,255,255,0.56)" fontSize="13" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">HIGHER PREMIUM ASKS</text>
              <text x="74" y="378" fill="rgba(255,255,255,0.56)" fontSize="13" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">FLOOR BID / EXIT LANE</text>

              <text x="46" y="405" fill="rgba(255,255,255,0.58)" fontSize="13" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.8">Low demand</text>
              <text x="406" y="405" fill="rgba(255,255,255,0.58)" fontSize="13" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.8">Balanced</text>
              <text x="780" y="405" fill="rgba(255,255,255,0.58)" fontSize="13" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.8">Hot market</text>

              <text x="86" y="244" fill="rgba(124,183,246,0.9)" fontSize="12" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.8">Expansion</text>
              <text x="332" y="188" fill="rgba(186,156,255,0.92)" fontSize="12" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.8">Stabilization</text>
              <text x="640" y="146" fill="rgba(244,207,102,0.92)" fontSize="12" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.8">Weak demand / treasury zone</text>
            </svg>
          </div>
        </FrostCard>

        <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 24, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
            What the pool actually does
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {[
              ["Mint", "A fresh mint routes capital into the reserve on day one instead of waiting for secondary demand."],
              ["Quote the floor", "The protocol only tries to guarantee the collection floor. Rare pieces still price above it in the market."],
              ["Absorb weakness", "If demand fades, treasury and burn logic can remove stale inventory instead of pretending infinite liquidity exists."],
              ["Reward conviction", "Stakers earn a slice of both buy-side and sell-side fees for locking supply and tightening the market."],
            ].map(([title, body]) => (
              <div key={title} style={{ padding: 14, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
                  {title}
                </div>
                <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                  {body}
                </div>
              </div>
            ))}
          </div>
        </FrostCard>
      </div>
    </FrostCard>
  );
}

function DataBadge({ isLive, error }) {
  const hasError = Boolean(error) && !isLive;
  const bg = isLive ? COLORS.greenSoft : hasError ? COLORS.redSoft : COLORS.yellowSoft;
  const fg = isLive ? COLORS.green : hasError ? COLORS.red : COLORS.yellow;
  const border = isLive ? "rgba(110,231,183,0.25)" : hasError ? "rgba(251,113,133,0.25)" : "rgba(244,207,102,0.25)";
  const label = isLive ? "Live" : hasError ? "Offline" : "Preview";

  return (
    <span
      title={hasError ? error : undefined}
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 9,
        fontFamily: fonts,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        cursor: hasError ? "help" : "default",
      }}
    >
      {label}
    </span>
  );
}

function fmtEth(val, digits = 5) {
  if (val == null) return "—";
  return `${Number(val).toFixed(digits)} ETH`;
}

function fmtPct(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

function HomePage({ setPage, pool, isLive, poolError }) {
  const features = [
    {
      title: "SSTORE2-backed art",
      desc: "Images live as packed pixel data inside Ethereum storage patterns, not external image hosting.",
      tone: "accent",
    },
    {
      title: "Floor-liquidity thesis",
      desc: "The protocol quotes the floor while the market decides which pieces deserve premium prices.",
      tone: "green",
    },
    {
      title: "Gallery-style market",
      desc: "The interface should feel curated and calm, with strong cards and clear spacing, not exchange noise.",
      tone: "purple",
    },
  ];

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "118px 18px 64px" }}>
      <HeroGallery pool={pool} isLive={isLive} />

      <div className="site-reveal-soft" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16, alignItems: "center", ...revealStyle(320) }}>
        <MetalButton onClick={() => setPage("mint")} tone="accent">
          Open mint room
        </MetalButton>
        <MetalButton onClick={() => setPage("market")} tone="ghost">
          Browse market cards
        </MetalButton>
        <MetalButton onClick={() => setPage("staking")} tone="purple">
          Earn fees
        </MetalButton>
        <DataBadge isLive={isLive} error={poolError} />
      </div>

      <FrostCard className="site-reveal" style={{ padding: 20, marginTop: 26, ...revealStyle(620) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: -0.8 }}>
              Protocol core
            </div>
            <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
              Three short ideas that explain what this protocol is before the deeper liquidity diagram.
            </div>
          </div>
          <Eyebrow tone="purple">Core notes</Eyebrow>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 16, alignItems: "stretch" }}>
          {features.map((feature, index) => (
            <FrostCard key={feature.title} className="site-reveal" style={{ padding: 18, background: COLORS.surfaceStrong, minHeight: 168, display: "flex", flexDirection: "column", justifyContent: "space-between", ...revealStyle(680 + index * 70) }}>
              <Eyebrow tone={feature.tone}>Protocol note</Eyebrow>
              <div style={{ marginTop: 12, color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: -0.7 }}>
                {feature.title}
              </div>
              <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.75 }}>
                {feature.desc}
              </div>
            </FrostCard>
          ))}
        </div>
      </FrostCard>

      <LiquiditySystemOverview className="site-reveal" style={{ marginTop: 14, ...revealStyle(760) }} />
    </div>
  );
}

function explorerTxUrl(txHash, chainId) {
  const explorers = {
    "1": "https://etherscan.io",
    "11155111": "https://sepolia.etherscan.io",
    "8453": "https://basescan.org",
    "84532": "https://sepolia.basescan.org",
  };
  const base = explorers[chainId];
  return base ? `${base}/tx/${txHash}` : null;
}

function TxStatusBar({ txStatus, txHash, chainId }) {
  if (!txStatus && !txHash) return null;
  const isSuccess = txStatus?.includes("confirmed");
  const isError = txStatus?.includes("failed") || txStatus?.includes("Failed") || txStatus?.includes("revert");
  const color = isSuccess ? COLORS.green : isError ? COLORS.red : COLORS.text;
  const url = txHash ? explorerTxUrl(txHash, chainId) : null;

  return (
    <div style={{ marginTop: 12 }}>
      {txStatus ? (
        <div style={{ color, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
          {txStatus}
        </div>
      ) : null}
      {txHash ? (
        <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7, wordBreak: "break-all" }}>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.accent, textDecoration: "underline" }}>
              View on explorer
            </a>
          ) : (
            <>Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}</>
          )}
        </div>
      ) : null}
    </div>
  );
}

const SUPPORTED_CHAINS = ["1", "11155111", "84532", "31337"];
const CHAIN_LABELS = { "1": "Ethereum", "11155111": "Sepolia", "84532": "Base Sepolia", "31337": "Hardhat" };

function checkChain(wallet) {
  if (wallet?.chainId && !SUPPORTED_CHAINS.includes(wallet.chainId)) {
    return `Wrong network (chainId ${wallet.chainId}). Switch to Ethereum, Sepolia, or Base Sepolia.`;
  }
  return null;
}

async function switchToChain(targetChainId) {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + Number(targetChainId).toString(16) }],
    });
  } catch {
    // Chain not added or user rejected — ignore
  }
}

function WrongChainBanner({ wallet }) {
  const chainErr = checkChain(wallet);
  if (!chainErr || !wallet?.account) return null;
  return (
    <div style={{
      padding: "10px 16px", borderRadius: 14, marginBottom: 12,
      background: COLORS.yellowSoft, border: `1px solid ${COLORS.yellow}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <span style={{ color: COLORS.yellow, fontFamily: fonts, fontSize: 11 }}>{chainErr}</span>
      <MetalButton
        onClick={() => switchToChain("11155111")}
        tone="yellow"
        size="xs"
        style={{
          minHeight: 30,
          padding: "6px 12px",
          whiteSpace: "nowrap",
        }}
      >
        Switch to Sepolia
      </MetalButton>
    </div>
  );
}

function MintPage({ wallet, onConnectWallet, appConfig, pool, isLive, poolError }) {
  const [payloadHex, setPayloadHex] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompactMintLayout, setIsCompactMintLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1020 : false
  );

  const routerAddress = appConfig?.routerAddress || "";
  const payloadBytes = ethers.utils.isHexString(payloadHex) ? ethers.utils.hexDataLength(payloadHex) : 0;
  const payloadValid = isValidMintPayload(payloadHex);
  const mintPriceLabel = isLive && pool.mintPriceEth != null
    ? `${pool.mintPriceEth} ETH`
    : "— ETH";
  const mintedCount = Number(pool.totalMinted || 0);
  const mintedProgress = Math.min((mintedCount / MINT_TARGET_SUPPLY) * 100, 100);
  const stageLabel = isLive ? "Public mint live" : "Preview mode";
  const networkLabel = wallet?.chainId ? CHAIN_LABELS[String(wallet.chainId)] || `Chain ${wallet.chainId}` : "Connect wallet";
  const mintMainColumns = isCompactMintLayout ? "1fr" : "minmax(0, 0.94fr) minmax(360px, 0.92fr)";
  const mintMiniColumns = isCompactMintLayout ? "1fr" : "repeat(3, minmax(0, 1fr))";

  useEffect(() => {
    const syncPayload = () => {
      const next = readStoredMintPayload();
      if (next) setPayloadHex(next);
    };
    syncPayload();
    window.addEventListener("focus", syncPayload);
    window.addEventListener("storage", syncPayload);
    return () => {
      window.removeEventListener("focus", syncPayload);
      window.removeEventListener("storage", syncPayload);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function updateLayoutMode() {
      setIsCompactMintLayout(window.innerWidth < 1020);
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  async function handleMint() {
    if (!wallet?.provider || !wallet?.account) {
      setTxStatus("Connect wallet first.");
      return;
    }
    if (!routerAddress) { setTxStatus("Router address not set in appConfig."); return; }
    const chainErr = checkChain(wallet);
    if (chainErr) { setTxStatus(chainErr); return; }
    if (!payloadValid) { setTxStatus("Need a valid 512-byte payload from the Pixel Editor."); return; }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus("Awaiting wallet confirmation...");
      const signer = wallet.provider.getSigner();
      const router = new ethers.Contract(routerAddress, PIXEL_ROUTER_ABI, signer);
      const price = await router.mintPrice();
      const tx = await router.mint(ethers.utils.arrayify(payloadHex), { value: price });
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Mint confirmed on-chain.");
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Mint failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "118px 18px 64px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mintMainColumns,
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <FrostCard className="site-reveal" style={{ padding: 22, height: "100%", display: "flex", flexDirection: "column", ...revealStyle(90) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: -0.9 }}>
                Mint preview
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 4 }}>
                The editor payload becomes the actual on-chain image, not an off-chain placeholder.
              </div>
            </div>
            <DataBadge isLive={isLive} error={poolError} />
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <PixelPayloadPreview payloadHex={payloadHex} />
          </div>
        </FrostCard>

        <div style={{ display: "grid", gap: 14, height: "100%", alignContent: "stretch" }}>
          <FrostCard className="site-reveal" style={{ padding: 24, height: "100%", display: "flex", flexDirection: "column", ...revealStyle(130) }}>
            <Eyebrow tone="purple">Mint collection</Eyebrow>
            <div style={{ marginTop: 14, color: COLORS.text, fontFamily: fontDisplay, fontSize: 42, fontWeight: 600, letterSpacing: -1.6, lineHeight: 0.94 }}>
              Mint OnChainPixel
            </div>
            <div style={{ marginTop: 12, color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.8 }}>
              Every mint creates a fully on-chain 32×32 piece, seeds the floor-liquidity reserve, and routes part of the capital into treasury and protocol support lanes.
            </div>

            <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 22, marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
                    {stageLabel}
                  </div>
                  <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                    Router path: mint the art, seed the reserve, and update market state in one motion.
                  </div>
                </div>
                <Eyebrow tone={payloadValid ? "green" : "accent"}>
                  {payloadValid ? "Payload ready" : "Editor needed"}
                </Eyebrow>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 16, alignItems: "stretch" }}>
                <div>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                    Mint price
                  </div>
                  <div style={{ marginTop: 7, color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, lineHeight: 0.98, overflowWrap: "anywhere" }}>
                    {mintPriceLabel}
                  </div>
                </div>
                <div>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                    Network
                  </div>
                  <div style={{ marginTop: 7, color: COLORS.purple, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600, lineHeight: 0.98, overflowWrap: "anywhere" }}>
                    {networkLabel}
                  </div>
                </div>
                <div>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                    Collection target
                  </div>
                  <div style={{ marginTop: 7, color: COLORS.green, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, lineHeight: 0.98 }}>
                    {MINT_TARGET_SUPPLY.toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11 }}>Minted progress</span>
                  <span style={{ color: COLORS.text, fontFamily: fonts, fontSize: 11, fontWeight: 700 }}>
                    {mintedCount.toLocaleString()} / {MINT_TARGET_SUPPLY.toLocaleString()}
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.06)", marginTop: 8 }}>
                  <div
                    style={{
                      width: `${mintedProgress}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #7CB7F6, #BA9CFF, #F4CF66)",
                    }}
                  />
                </div>
              </div>
            </FrostCard>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <MetalButton
                onClick={handleMint}
                disabled={isSubmitting || !payloadValid}
                block
                size="lg"
                tone={payloadValid ? "accent" : "ghost"}
                active={payloadValid}
                style={{
                  width: "100%",
                  cursor: isSubmitting ? "progress" : payloadValid ? "pointer" : "not-allowed",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Minting..." : payloadValid ? `Mint for ${mintPriceLabel}` : "Draw pixel art first"}
              </MetalButton>
              <WrongChainBanner wallet={wallet} />
              <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
            </div>
          </FrostCard>

          <div style={{ display: "grid", gridTemplateColumns: mintMiniColumns, gap: 12, alignItems: "stretch" }}>
            <MetricPanel className="site-reveal-soft" style={revealStyle(180)} label="Canvas" value="32×32" sub="4-bit packed pixel payload" tone="purple" />
            <MetricPanel className="site-reveal-soft" style={revealStyle(220)} label="Minted" value={isLive ? mintedCount.toLocaleString() : "—"} sub="Historical mint count" tone="green" />
            <MetricPanel className="site-reveal-soft" style={revealStyle(260)} label="Split" value="60 / 10 / 30" sub="Pool / Treasury / Ops" tone="yellow" />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: mintMainColumns,
          gap: 16,
          marginTop: 16,
          alignItems: "stretch",
        }}
      >
        <FrostCard className="site-reveal" style={{ padding: 22, height: "100%", display: "flex", flexDirection: "column", ...revealStyle(300) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
                Payload bridge
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 4, lineHeight: 1.7 }}>
                Pull the current editor payload, review the raw bytes, then mint it directly through the router.
              </div>
            </div>
            <MetalButton
              onClick={() => setPayloadHex(readStoredMintPayload())}
              tone="ghost"
              size="xs"
              style={{ minHeight: 30, padding: "6px 10px" }}
            >
              Pull from editor
            </MetalButton>
          </div>

          <textarea
            value={payloadHex}
            onChange={(e) => setPayloadHex(e.target.value.trim())}
            placeholder="0x...512-byte hex from Pixel Editor"
            wrap="soft"
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 196,
              flex: 1,
              resize: "vertical",
              background: COLORS.surfaceStrong,
              border: `1px solid ${payloadValid || !payloadHex ? COLORS.border : COLORS.red}`,
              borderRadius: 16,
              padding: 14,
              color: COLORS.text,
              fontFamily: fonts,
              fontSize: 10,
              lineHeight: 1.55,
              boxSizing: "border-box",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-all",
              overflowX: "hidden",
              outline: "none",
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: mintMiniColumns, gap: 12, marginTop: 12, alignItems: "stretch" }}>
            <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                Payload bytes
              </div>
              <div style={{ marginTop: 8, color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
                {payloadBytes || 0}
              </div>
            </FrostCard>
            <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                Validation
              </div>
              <div style={{ marginTop: 8, color: payloadValid ? COLORS.green : COLORS.red, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
                {payloadValid ? "Ready" : "Waiting"}
              </div>
            </FrostCard>
            <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                Storage format
              </div>
              <div style={{ marginTop: 8, color: COLORS.purple, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
                4-bit
              </div>
            </FrostCard>
          </div>

          <div style={{ marginTop: 10, color: payloadValid ? COLORS.green : COLORS.textMuted, fontFamily: fonts, fontSize: 10, lineHeight: 1.7 }}>
            {payloadHex
              ? payloadValid
                ? "Payload is valid and mint-ready."
                : `${payloadBytes} bytes loaded. A valid mint payload must be exactly 512 bytes.`
              : "Draw in the Pixel Editor first, then pull the packed payload here."}
          </div>
        </FrostCard>

        <div style={{ display: "grid", gap: 12, height: "100%", alignContent: "stretch" }}>
          <FrostCard className="site-reveal" style={{ padding: 20, ...revealStyle(360) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
              Mint schedule
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ padding: 14, borderRadius: 18, background: COLORS.surfaceStrong, border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>
                      Public router mint
                    </div>
                    <div style={{ marginTop: 4, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                      Open when the router address is configured and the connected network is supported.
                    </div>
                  </div>
                  <Eyebrow tone={payloadValid ? "green" : "yellow"}>
                    {payloadValid ? "Eligible" : "Needs art"}
                  </Eyebrow>
                </div>
                <div style={{ marginTop: 10, color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                  Mint price {mintPriceLabel} · Network {networkLabel}
                </div>
              </div>
            </div>
          </FrostCard>

          <FrostCard className="site-reveal" style={{ padding: 20, flex: 1, ...revealStyle(420) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
              What happens when you mint
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {[
                ["Reserve seed", "60% of each mint goes to the pool reserve and initializes the floor-liquidity side of the protocol."],
                ["Treasury lane", "10% is routed to treasury for buybacks, stale inventory cleanup and system balancing."],
                ["Protocol ops", "30% sustains rollout, collection maintenance and the operating layer around the protocol."],
              ].map(([title, body]) => (
                <div key={title} style={{ padding: 14, borderRadius: 18, background: COLORS.surfaceStrong, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
                    {title}
                  </div>
                  <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                    {body}
                  </div>
                </div>
              ))}
            </div>
          </FrostCard>
        </div>
      </div>
    </div>
  );
}

function MarketplacePage({ pool, isLive, wallet, onConnectWallet, appConfig, poolError }) {
  const [tab, setTab] = useState("buy");
  const [sellTokenId, setSellTokenId] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collectionTab, setCollectionTab] = useState("items");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState("price-low");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompactMarketLayout, setIsCompactMarketLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1080 : false
  );

  const routerAddress = appConfig?.routerAddress || "";
  const nftAddress = appConfig?.nftAddress || "";
  const ethUsd = pool.ethUsd || 2000;
  const collectionSupply = 10000;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function updateLayoutMode() {
      setIsCompactMarketLayout(window.innerWidth < 1080);
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  const marketItems = React.useMemo(() => {
    const backgrounds = ["Lilac", "Sky", "Coral", "Cream", "Volt", "Night"];
    const headwear = ["Beanie", "Halo", "Cap", "Bucket", "Mohawk", "None"];
    const faces = ["Plain", "Shades", "Visor", "Scar", "Pipe", "Mask"];
    const baseFloor = Number(pool.floor || 0);
    const fallbackFloor = 0.0425;
    const anchor = baseFloor > 0 ? baseFloor : fallbackFloor;

    return Array.from({ length: 18 }, (_, index) => {
      const tokenId = 1000 + index * 173;
      const listed = index % 5 !== 0;
      const inPool = index % 7 === 0;
      const price = Number((anchor * (1 + ((index % 6) * 0.018 + (index % 3) * 0.008))).toFixed(4));
      const lastSale = Number((price * (0.91 + ((index % 4) * 0.017))).toFixed(4));

      return {
        id: tokenId,
        seed: tokenId,
        listed,
        inPool,
        price,
        lastSale,
        background: backgrounds[index % backgrounds.length],
        headwear: headwear[index % headwear.length],
        face: faces[index % faces.length],
      };
    });
  }, [pool.floor]);

  const visibleItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = marketItems.filter((item) => {
      if (statusFilter === "listed" && !item.listed) return false;
      if (statusFilter === "pool" && !item.inPool) return false;
      if (!query) return true;
      const haystack = `#${item.id} ${item.background} ${item.headwear} ${item.face}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered];
    if (sortMode === "price-high") sorted.sort((a, b) => b.price - a.price);
    if (sortMode === "recent") sorted.sort((a, b) => b.id - a.id);
    if (sortMode === "price-low") sorted.sort((a, b) => a.price - b.price);
    return sorted;
  }, [marketItems, searchQuery, sortMode, statusFilter]);

  const traitCounts = React.useMemo(() => {
    const countBy = (key) =>
      marketItems.reduce((acc, item) => {
        acc[item[key]] = (acc[item[key]] || 0) + 1;
        return acc;
      }, {});
    return {
      background: countBy("background"),
      headwear: countBy("headwear"),
      face: countBy("face"),
    };
  }, [marketItems]);

  async function handleBuy() {
    if (!wallet?.provider || !wallet?.account) { setTxStatus("Connect wallet first."); return; }
    if (!routerAddress) { setTxStatus("Router address not set."); return; }
    const chainErr = checkChain(wallet);
    if (chainErr) { setTxStatus(chainErr); return; }
    if (!pool.canBuy) { setTxStatus("Pool buying is currently disabled (need Stabilization + inventory)."); return; }

    try {
      setIsSubmitting(true); setTxHash(""); setTxStatus("Reading buy price...");
      const signer = wallet.provider.getSigner();
      const router = new ethers.Contract(routerAddress, PIXEL_ROUTER_ABI, signer);
      const prices = await router.getPrices();
      const buyPrice = prices.buyPrice;
      const fee = buyPrice.mul(250).div(10000);
      const cost = buyPrice.add(fee);
      // 1% slippage buffer
      const maxPrice = cost.add(cost.div(100));

      setTxStatus(`Buying at ${formatEth(cost)}. Confirm in wallet...`);
      const tx = await router.buyNFT(maxPrice, { value: maxPrice });
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Buy confirmed on-chain.");
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Buy failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSell() {
    if (!wallet?.provider || !wallet?.account) { setTxStatus("Connect wallet first."); return; }
    if (!routerAddress || !nftAddress) { setTxStatus("Router or NFT address not set."); return; }
    const chainErr = checkChain(wallet);
    if (chainErr) { setTxStatus(chainErr); return; }
    if (!pool.canSell) { setTxStatus("Pool selling is currently disabled (need post-launch + coverage)."); return; }

    const tokenId = parseInt(sellTokenId, 10);
    if (isNaN(tokenId) || tokenId < 0) { setTxStatus("Enter a valid token ID."); return; }

    try {
      setIsSubmitting(true); setTxHash(""); setTxStatus("Checking ownership and approval...");
      const signer = wallet.provider.getSigner();
      const nft = new ethers.Contract(nftAddress, ERC721_ABI, signer);
      const router = new ethers.Contract(routerAddress, PIXEL_ROUTER_ABI, signer);

      // Check ownership
      const owner = await nft.ownerOf(tokenId);
      if (owner.toLowerCase() !== wallet.account.toLowerCase()) {
        setTxStatus(`You don't own token #${tokenId}.`);
        setIsSubmitting(false);
        return;
      }

      // Approve router if needed
      const approved = await nft.isApprovedForAll(wallet.account, routerAddress);
      if (!approved) {
        setTxStatus("Approving router to transfer your NFT...");
        const approveTx = await nft.setApprovalForAll(routerAddress, true);
        await approveTx.wait();
      }

      const prices = await router.getPrices();
      const sellPrice = prices.sellPrice;
      if (sellPrice.isZero()) {
        setTxStatus("Current sell quote is unavailable.");
        return;
      }

      const minPrice = sellPrice.sub(sellPrice.div(100)); // 1% slippage buffer
      setTxStatus(`Selling with 1% slippage buffer. Confirm in wallet...`);
      const tx = await router.sellNFT(tokenId, minPrice);
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Sell confirmed on-chain.");
      setSellTokenId("");
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Sell failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "118px 18px 64px" }}>
      <FrostCard className="site-reveal" style={{ padding: 22, ...revealStyle(80) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, overflow: "hidden", border: `1px solid ${COLORS.borderStrong}`, background: COLORS.surfaceStrong }}>
              <PixelAvatar size={72} seed={8888} />
            </div>
            <div>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 34, fontWeight: 600, letterSpacing: -1.2 }}>
                OnChainPixel Genesis
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Eyebrow tone="accent">Ethereum</Eyebrow>
                <Eyebrow tone="purple">{collectionSupply.toLocaleString()} supply</Eyebrow>
                <Eyebrow tone="green">Fully on-chain</Eyebrow>
              </div>
              <div style={{ marginTop: 10, color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.7, maxWidth: 520 }}>
                Discovery layer for the collection, with OpenSea-like browsing and a native liquidity lane living beside the item grid instead of outside it.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(110px, 1fr))", gap: 10, minWidth: "min(100%, 480px)", alignItems: "stretch" }}>
            <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 20, minHeight: 118, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Floor price</div>
              <div style={{ marginTop: 8, color: COLORS.yellow, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{fmtEth(pool.floor)}</div>
            </FrostCard>
            <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 20, minHeight: 118, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Top offer</div>
              <div style={{ marginTop: 8, color: COLORS.red, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
                {pool.sellPrice ? fmtEth(pool.sellPrice * 0.975) : "—"}
              </div>
            </FrostCard>
            <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 20, minHeight: 118, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Pool reserve</div>
              <div style={{ marginTop: 8, color: COLORS.accent, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{fmtEth(pool.ethBalance, 2)}</div>
            </FrostCard>
            <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 20, minHeight: 118, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Market state</div>
              <div style={{ marginTop: 8, color: COLORS.green, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.marketState || "—"}</div>
            </FrostCard>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
          {[
            ["items", "Items"],
            ["offers", "Offers"],
            ["holders", "Holders"],
            ["activity", "Activity"],
          ].map(([id, label]) => (
            <MetalButton
              key={id}
              onClick={() => setCollectionTab(id)}
              tone={collectionTab === id ? "purple" : "ghost"}
              active={collectionTab === id}
              size="sm"
              style={{ padding: "10px 18px" }}
            >
              {label}
            </MetalButton>
          ))}
          <div style={{ marginLeft: "auto" }}>
            <DataBadge isLive={isLive} error={poolError} />
          </div>
        </div>
      </FrostCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isCompactMarketLayout ? "1fr" : "260px minmax(0, 1fr)",
          gap: 14,
          marginTop: 16,
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <FrostCard className="site-reveal-soft" style={{ padding: 18, ...revealStyle(140) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
              Filters
            </div>
            <div style={{ marginTop: 14, color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              Status
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {[
                ["all", "All"],
                ["listed", "Listed"],
                ["pool", "Pool inventory"],
              ].map(([id, label]) => (
                <MetalButton
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  tone={statusFilter === id ? "accent" : "ghost"}
                  active={statusFilter === id}
                  size="xs"
                  style={{ padding: "8px 12px" }}
                >
                  {label}
                </MetalButton>
              ))}
            </div>

            <div style={{ marginTop: 18, color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              Traits
            </div>
            {[
              ["Background", traitCounts.background],
              ["Headwear", traitCounts.headwear],
              ["Face", traitCounts.face],
            ].map(([label, counts]) => (
              <div key={label} style={{ marginTop: 12 }}>
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
                  {label}
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {Object.entries(counts).slice(0, 4).map(([name, count]) => (
                    <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11 }}>
                      <span>{name}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </FrostCard>

          <FrostCard className="site-reveal-soft" style={{ padding: 18, ...revealStyle(180) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Pool lane
            </div>
            <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
              Pool inventory is the instant-exit layer. The grid is the discovery layer. Together they act like a marketplace plus an embedded floor AMM.
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 16, background: COLORS.surfaceStrong }}>
                <div style={{ color: COLORS.green, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Buy lane</div>
                <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                  Pulls from pool inventory when stabilization conditions are met.
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: 16, background: COLORS.surfaceStrong }}>
                <div style={{ color: COLORS.red, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Sell lane</div>
                <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                  Lets holders exit at the collection floor instead of hunting for bids.
                </div>
              </div>
            </div>
          </FrostCard>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <FrostCard className="site-reveal" style={{ padding: 18, ...revealStyle(220) }}>
            <div style={{ display: "grid", gridTemplateColumns: isCompactMarketLayout ? "1fr" : "minmax(0,1fr) auto auto", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: COLORS.surfaceStrong,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 18,
                  padding: "12px 14px",
                }}
              >
                <span style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 13 }}>⌕</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by item or trait"
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    color: COLORS.text,
                    outline: "none",
                    fontFamily: fonts,
                    fontSize: 13,
                  }}
                />
              </div>

              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value)}
                style={{
                  minHeight: 48,
                  padding: "0 16px",
                  borderRadius: 18,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.surfaceStrong,
                  color: COLORS.text,
                  fontFamily: fonts,
                  fontSize: 12,
                  outline: "none",
                }}
              >
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
                <option value="recent">Recently added</option>
              </select>

              <FrostCard style={{ padding: "11px 14px", background: COLORS.surfaceStrong, borderRadius: 18 }}>
                <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11 }}>
                  {visibleItems.length} visible / {collectionSupply.toLocaleString()} total
                </div>
              </FrostCard>
            </div>
          </FrostCard>

          <PoolViz className="site-reveal" style={revealStyle(260)} pool={pool} />

          <FrostCard className="site-reveal" style={{ padding: 20, ...revealStyle(300) }}>
            <div className="site-reveal-soft" style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              {["buy", "sell"].map((type) => (
                <MetalButton
                  key={type}
                  onClick={() => { setTab(type); setTxStatus(""); setTxHash(""); }}
                  tone={type === "buy" ? "green" : "red"}
                  active={tab === type}
                  size="sm"
                  style={{ padding: "11px 18px", textTransform: "capitalize" }}
                >
                  {type === "buy" ? "Buy from pool" : "Sell to pool"}
                </MetalButton>
              ))}
              <DataBadge isLive={isLive} error={poolError} />
            </div>

            {tab === "buy" ? (
              <div>
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
                  Buy from liquidity pool
                </div>
                <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
                  Buys the next available NFT from pool inventory at the ask price. This is the fast lane, not the premium trait discovery lane.
                  {!pool.canBuy ? <span style={{ color: COLORS.yellow }}> Buying opens only when stabilization and inventory conditions are met.</span> : null}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isCompactMarketLayout ? "1fr" : "repeat(3, 1fr)", gap: 12, marginTop: 16, alignItems: "stretch" }}>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Ask quote</div>
                    <div style={{ marginTop: 8, color: COLORS.green, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.buyPrice ? fmtEth(pool.buyPrice) : "—"}</div>
                  </FrostCard>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Inventory</div>
                    <div style={{ marginTop: 8, color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.poolNfts}</div>
                  </FrostCard>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Coverage</div>
                    <div style={{ marginTop: 8, color: COLORS.purple, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{fmtPct(pool.liqRatio)}</div>
                  </FrostCard>
                </div>

                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <MetalButton
                    onClick={handleBuy}
                    disabled={isSubmitting || !pool.canBuy}
                    block
                    tone="green"
                    active={pool.canBuy}
                    size="lg"
                    style={{
                      width: "100%",
                      cursor: isSubmitting ? "progress" : pool.canBuy ? "pointer" : "not-allowed",
                      opacity: isSubmitting ? 0.7 : 1,
                    }}
                  >
                    {isSubmitting ? "Buying..." : pool.canBuy ? `Buy for ~${fmtEth(pool.buyPrice)}` : "Buy disabled"}
                  </MetalButton>
                  <WrongChainBanner wallet={wallet} />
                  <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
                  Sell into the floor bid
                </div>
                <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
                  Sell your NFT into the pool at the current floor bid minus fee. Click an item card below to prefill the token ID, or type it manually.
                  {!pool.canSell ? <span style={{ color: COLORS.yellow }}> Selling opens only after launch protection ends and coverage is healthy enough.</span> : null}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isCompactMarketLayout ? "1fr" : "repeat(3, 1fr)", gap: 12, marginTop: 16, alignItems: "stretch" }}>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Sell quote</div>
                    <div style={{ marginTop: 8, color: COLORS.red, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.sellPrice ? fmtEth(pool.sellPrice) : "—"}</div>
                  </FrostCard>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Net payout</div>
                    <div style={{ marginTop: 8, color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.sellPrice ? fmtEth(pool.sellPrice * 0.975) : "—"}</div>
                  </FrostCard>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Selected token</div>
                    <div style={{ marginTop: 8, color: COLORS.purple, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{sellTokenId || "—"}</div>
                  </FrostCard>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 }}>
                    Token ID to sell
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={sellTokenId}
                    onChange={(e) => setSellTokenId(e.target.value)}
                    placeholder="Select a card or enter token ID"
                    style={{
                      width: "100%",
                      padding: 12,
                      background: COLORS.surfaceStrong,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 14,
                      color: COLORS.text,
                      fontFamily: fonts,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <MetalButton
                    onClick={handleSell}
                    disabled={isSubmitting || !pool.canSell}
                    block
                    tone="red"
                    active={pool.canSell}
                    size="lg"
                    style={{
                      width: "100%",
                      cursor: isSubmitting ? "progress" : pool.canSell ? "pointer" : "not-allowed",
                      opacity: isSubmitting ? 0.7 : 1,
                    }}
                  >
                    {isSubmitting ? "Selling..." : pool.canSell ? `Sell for ~${fmtEth(pool.sellPrice)}` : "Sell disabled"}
                  </MetalButton>
                  <WrongChainBanner wallet={wallet} />
                  <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
                </div>
              </div>
            )}
          </FrostCard>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isCompactMarketLayout ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {visibleItems.map((item, index) => {
              const selected = String(item.id) === String(sellTokenId);
              return (
                <FrostCard
                  key={item.id}
                  className="site-reveal-soft"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    cursor: "pointer",
                    borderColor: selected ? COLORS.borderStrong : COLORS.border,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    ...revealStyle(340 + index * 20),
                  }}
                  onClick={() => setSellTokenId(String(item.id))}
                >
                  <div style={{ padding: 14, background: item.inPool ? COLORS.accentSoft : COLORS.surfaceStrong, display: "grid", placeItems: "center", aspectRatio: "1 / 1" }}>
                    <PixelAvatar size={152} seed={item.seed} />
                  </div>
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 19, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        OCP #{item.id}
                      </div>
                      <div
                        style={{
                          padding: "5px 10px",
                          borderRadius: 999,
                          background: item.inPool ? COLORS.accentSoft : item.listed ? COLORS.greenSoft : COLORS.surfaceStrong,
                          color: item.inPool ? COLORS.accent : item.listed ? COLORS.green : COLORS.textDim,
                          fontFamily: fonts,
                          fontSize: 10,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        {item.inPool ? "Pool" : item.listed ? "Listed" : "Held"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Eyebrow tone="purple">{item.background}</Eyebrow>
                      <Eyebrow tone="accent">{item.headwear}</Eyebrow>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600, lineHeight: 0.98 }}>
                          {item.price.toFixed(4)} ETH
                        </div>
                        <div style={{ marginTop: 4, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11 }}>
                          Last sale {item.lastSale.toFixed(4)} ETH
                        </div>
                      </div>
                      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, textAlign: "right", lineHeight: 1.7 }}>
                        <div>Face: {item.face}</div>
                        <div>Collection supply: {collectionSupply.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </FrostCard>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StakingPage({ pool, isLive, wallet, onConnectWallet, appConfig, poolError }) {
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStakeTokenId, setSelectedStakeTokenId] = useState(null);
  const [selectedUnstakeTokenId, setSelectedUnstakeTokenId] = useState(null);
  const [userStaked, setUserStaked] = useState([]);
  const [ownedTokenIds, setOwnedTokenIds] = useState([]);
  const [pendingFees, setPendingFees] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [isCompactStakingLayout, setIsCompactStakingLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1040 : false
  );

  const poolAddress = appConfig?.poolAddress || "";
  const nftAddress = appConfig?.nftAddress || "";

  // Load user staking data
  useEffect(() => {
    if (!wallet?.provider || !wallet?.account || !poolAddress) {
      setUserStaked([]);
      setPendingFees(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingUser(true);
      try {
        const poolContract = new ethers.Contract(poolAddress, PIXEL_POOL_ABI, wallet.provider);
        const [staked, fees] = await Promise.all([
          poolContract.getUserStakedTokens(wallet.account),
          poolContract.viewPendingFees(wallet.account),
        ]);
        if (!cancelled) {
          setUserStaked(staked.map((t) => t.toNumber()));
          setPendingFees(fees);
        }
      } catch {
        if (!cancelled) { setUserStaked([]); setPendingFees(null); }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [wallet?.provider, wallet?.account, poolAddress, txHash]);

  useEffect(() => {
    if (!wallet?.provider || !wallet?.account || !nftAddress) {
      setOwnedTokenIds([]);
      setSelectedStakeTokenId(null);
      return;
    }

    let cancelled = false;

    async function loadOwned() {
      setLoadingOwned(true);
      try {
        const nft = new ethers.Contract(nftAddress, ERC721_ABI, wallet.provider);
        const owner = wallet.account.toLowerCase();
        const balance = Number(await nft.balanceOf(wallet.account));
        const upperBound = Math.min(Number(pool?.totalMinted || 0), 10000);

        if (!balance || !upperBound) {
          if (!cancelled) {
            setOwnedTokenIds([]);
            setSelectedStakeTokenId(null);
          }
          return;
        }

        const found = [];
        const batchSize = 120;

        for (let start = 0; start < upperBound && found.length < balance; start += batchSize) {
          const size = Math.min(batchSize, upperBound - start);
          const ids = Array.from({ length: size }, (_, index) => start + index);
          const matches = await Promise.all(
            ids.map(async (tokenId) => {
              try {
                const tokenOwner = await nft.ownerOf(tokenId);
                return tokenOwner.toLowerCase() === owner ? tokenId : null;
              } catch {
                return null;
              }
            })
          );
          if (cancelled) return;
          for (const tokenId of matches) {
            if (tokenId !== null) found.push(tokenId);
          }
        }

        if (!cancelled) {
          setOwnedTokenIds(found);
          setSelectedStakeTokenId((current) => (current != null && found.includes(current) ? current : found[0] ?? null));
        }
      } catch {
        if (!cancelled) {
          setOwnedTokenIds([]);
          setSelectedStakeTokenId(null);
        }
      } finally {
        if (!cancelled) setLoadingOwned(false);
      }
    }

    loadOwned();
    return () => {
      cancelled = true;
    };
  }, [wallet?.provider, wallet?.account, nftAddress, pool?.totalMinted, txHash]);

  useEffect(() => {
    setSelectedUnstakeTokenId((current) =>
      current != null && userStaked.includes(current) ? current : userStaked[0] ?? null
    );
  }, [userStaked]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function updateLayoutMode() {
      setIsCompactStakingLayout(window.innerWidth < 1040);
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  async function handleStake() {
    if (!wallet?.provider || !wallet?.account) { setTxStatus("Connect wallet first."); return; }
    if (!poolAddress || !nftAddress) { setTxStatus("Pool or NFT address not set."); return; }
    const chainErr = checkChain(wallet);
    if (chainErr) { setTxStatus(chainErr); return; }

    const tokenId = selectedStakeTokenId;
    if (tokenId == null) { setTxStatus("Choose an NFT to stake."); return; }

    try {
      setIsSubmitting(true); setTxHash(""); setTxStatus("Checking ownership...");
      const signer = wallet.provider.getSigner();
      const nft = new ethers.Contract(nftAddress, ERC721_ABI, signer);
      const poolContract = new ethers.Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const owner = await nft.ownerOf(tokenId);
      if (owner.toLowerCase() !== wallet.account.toLowerCase()) {
        setTxStatus(`You don't own token #${tokenId}.`);
        setIsSubmitting(false);
        return;
      }

      // Approve pool if needed
      const approved = await nft.isApprovedForAll(wallet.account, poolAddress);
      if (!approved) {
        setTxStatus("Approving pool to hold your NFT...");
        const approveTx = await nft.setApprovalForAll(poolAddress, true);
        await approveTx.wait();
      }

      setTxStatus("Staking. Confirm in wallet...");
      const tx = await poolContract.stake(tokenId);
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus(`Token #${tokenId} staked.`);
      setSelectedStakeTokenId(null);
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Stake failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnstake(tokenId) {
    if (!wallet?.provider || !wallet?.account) { setTxStatus("Connect wallet first."); return; }
    const chainErr = checkChain(wallet);
    if (chainErr) { setTxStatus(chainErr); return; }

    try {
      setIsSubmitting(true); setTxHash(""); setTxStatus(`Unstaking token #${tokenId}...`);
      const signer = wallet.provider.getSigner();
      const poolContract = new ethers.Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const tx = await poolContract.unstake(tokenId);
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus(`Token #${tokenId} unstaked. Pending fees paid out automatically.`);
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Unstake failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClaim() {
    if (!wallet?.provider || !wallet?.account) { setTxStatus("Connect wallet first."); return; }
    const chainErr = checkChain(wallet);
    if (chainErr) { setTxStatus(chainErr); return; }

    try {
      setIsSubmitting(true); setTxHash(""); setTxStatus("Claiming fees...");
      const signer = wallet.provider.getSigner();
      const poolContract = new ethers.Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const tx = await poolContract.claimFees();
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Fees claimed.");
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Claim failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasPending = pendingFees && !pendingFees.isZero();

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "118px 18px 64px" }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "stretch" }}>
        <MetricPanel className="site-reveal-soft" style={revealStyle(80)} label="Total staked" value={pool.totalStaked ?? "—"} sub="NFTs earning fees" tone="purple" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(120)} label="Your staked" value={loadingUser ? "..." : userStaked.length} sub={summarizeTokenIds(userStaked)} tone="accent" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(160)} label="Pending fees" value={hasPending ? formatEth(pendingFees) : "0 ETH"} sub={hasPending ? `~$${(Number(ethers.utils.formatEther(pendingFees)) * (pool.ethUsd || 2000)).toFixed(2)}` : "No fees to claim"} tone="green" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isCompactStakingLayout
            ? "1fr"
            : "minmax(0, 0.96fr) minmax(360px, 0.88fr)",
          gap: 14,
          marginTop: 18,
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <FrostCard className="site-reveal" style={{ padding: 24, minHeight: 380, display: "flex", flexDirection: "column", ...revealStyle(260) }}>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
            Stake NFT
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
            Lock your NFT in the pool to earn a share of trading fees.
          </div>
          <TokenGrid
            title="Your NFTs"
            tokens={ownedTokenIds}
            selectedTokenId={selectedStakeTokenId}
            onSelect={setSelectedStakeTokenId}
            loading={loadingOwned}
            emptyLabel={wallet?.account ? "No wallet NFTs available to stake." : "Connect wallet to load your NFTs."}
            tone="purple"
          />
          <MetalButton
            onClick={handleStake}
            disabled={isSubmitting || (wallet?.account ? selectedStakeTokenId == null : false)}
            block
            tone="purple"
            active={wallet?.account ? selectedStakeTokenId != null : true}
            size="md"
            style={{
              width: "100%",
              marginTop: 14,
              cursor: isSubmitting ? "progress" : wallet?.account ? (selectedStakeTokenId != null ? "pointer" : "not-allowed") : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Staking..." : wallet?.account ? (selectedStakeTokenId != null ? `Stake #${selectedStakeTokenId}` : "Select NFT to stake") : "Stake NFT"}
          </MetalButton>
          </FrostCard>

          <FrostCard className="site-reveal" style={{ padding: 24, minHeight: 380, display: "flex", flexDirection: "column", ...revealStyle(300) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Unstake NFT
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Withdraw your NFT. Pending fees are paid out automatically.
            </div>

            <TokenGrid
              title="Staked NFTs"
              tokens={userStaked}
              selectedTokenId={selectedUnstakeTokenId}
              onSelect={setSelectedUnstakeTokenId}
              loading={loadingUser}
              emptyLabel={wallet?.account ? "No staked NFTs yet." : "Connect wallet to load staked NFTs."}
              tone="red"
            />
            <MetalButton
              onClick={() => {
                if (selectedUnstakeTokenId == null) {
                  setTxStatus(wallet?.account ? "Choose an NFT to unstake." : "Connect wallet first.");
                  return;
                }
                handleUnstake(selectedUnstakeTokenId);
              }}
              disabled={isSubmitting || (wallet?.account ? selectedUnstakeTokenId == null : false)}
              block
              tone="red"
              active={wallet?.account ? selectedUnstakeTokenId != null : true}
              size="md"
              style={{
                width: "100%",
                marginTop: 14,
                cursor: isSubmitting ? "progress" : wallet?.account ? (selectedUnstakeTokenId != null ? "pointer" : "not-allowed") : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Unstaking..." : wallet?.account ? (selectedUnstakeTokenId != null ? `Unstake #${selectedUnstakeTokenId}` : "Select NFT to unstake") : "Unstake NFT"}
            </MetalButton>
          </FrostCard>
        </div>

        <FrostCard
          className="site-reveal"
          style={{
            aspectRatio: isCompactStakingLayout ? undefined : "1 / 1",
            minHeight: isCompactStakingLayout ? 320 : 360,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            justifySelf: isCompactStakingLayout ? "stretch" : "end",
            width: "100%",
            maxWidth: isCompactStakingLayout ? "100%" : 440,
            ...revealStyle(200),
          }}
        >
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
            Claim staking rewards
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
            Stakers earn a share of trade fees from both sides of the market (5% on buys and 5% on sells). Fees accumulate automatically and can be claimed at any time. Unstaking also pays out pending rewards.
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <MetalButton
              onClick={handleClaim}
              disabled={isSubmitting || (wallet?.account ? !hasPending : false)}
              block
              tone="green"
              active={wallet?.account ? hasPending : true}
              size="lg"
              style={{
                width: "100%",
                marginTop: "auto",
                cursor: isSubmitting ? "progress" : wallet?.account ? (hasPending ? "pointer" : "not-allowed") : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Claiming..." : wallet?.account ? (hasPending ? `Claim ${formatEth(pendingFees)}` : "No fees to claim") : "Claim fees"}
            </MetalButton>
          </div>
        </FrostCard>
      </div>

      {/* Status */}
      <div style={{ marginTop: 14 }}>
        <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
        <div style={{ marginTop: 8 }}>
          <DataBadge isLive={isLive} error={poolError} />
        </div>
      </div>
    </div>
  );
}

function buildPoolView(liveData) {
  if (!liveData) return MOCK_POOL;
  return {
    ethBalance: liveData.ethBalance,
    floor: liveData.floor,
    sellPrice: liveData.sellPrice,
    buyPrice: liveData.buyPrice,
    totalMinted: liveData.totalMinted,
    totalStaked: liveData.lockedSupply,
    poolNfts: liveData.poolNfts,
    circulating: liveData.circulatingSupply,
    emc: liveData.emc,
    liqRatio: liveData.liqRatio,
    protocolFees: liveData.protocolFees,
    treasuryBalance: liveData.treasuryBalance,
    marketState: liveData.marketState,
    canSell: liveData.canSell,
    canBuy: liveData.canBuy,
    ethUsd: liveData.ethUsd,
    mintPriceEth: liveData.mintPriceEth,
    // not available on-chain without indexer
    dailyVolume: null,
    trades24h: null,
  };
}

export default function OnchainPixelSite({ appConfig, wallet, onConnectWallet, themeMode, onToggleTheme }) {
  const [page, setPage] = useState("home");
  const { data: liveData, error: poolError, loading: poolLoading } = usePoolData({
    poolAddress: appConfig?.poolAddress,
    routerAddress: appConfig?.routerAddress,
    rpcUrl: appConfig?.rpcUrl,
    ethUsd: appConfig?.ethUsd,
    walletProvider: wallet?.provider,
  });

  const pool = buildPoolView(liveData);
  const isLive = Boolean(liveData);

  return (
    <div
      style={{
        minHeight: "100vh",
        color: COLORS.text,
        background: "transparent",
      }}
    >
      <SiteMotionStyles />
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <FloatingNav
        page={page}
        setPage={setPage}
        wallet={wallet}
        onConnectWallet={onConnectWallet}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
      />
      {page === "home" && <HomePage setPage={setPage} pool={pool} isLive={isLive} poolError={poolError} />}
      {page === "mint" && <MintPage wallet={wallet} onConnectWallet={onConnectWallet} appConfig={appConfig} pool={pool} isLive={isLive} poolError={poolError} />}
      {page === "market" && <MarketplacePage pool={pool} isLive={isLive} wallet={wallet} onConnectWallet={onConnectWallet} appConfig={appConfig} poolError={poolError} />}
      {page === "staking" && <StakingPage pool={pool} isLive={isLive} wallet={wallet} onConnectWallet={onConnectWallet} appConfig={appConfig} poolError={poolError} />}
    </div>
  );
}
