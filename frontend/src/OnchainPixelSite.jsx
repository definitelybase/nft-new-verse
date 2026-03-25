import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { PIXEL_ROUTER_ABI, ERC721_ABI, PIXEL_POOL_ABI } from "./pixelRouterAbi";
import usePoolData from "./usePoolData";

const COLORS = {
  bg: "#07070B",
  surface: "rgba(44, 47, 55, 0.92)",
  surfaceStrong: "rgba(55, 58, 67, 0.98)",
  border: "rgba(255, 255, 255, 0.11)",
  borderStrong: "rgba(255, 255, 255, 0.18)",
  text: "#F4F4F8",
  textMuted: "#B4B7C2",
  textDim: "#858997",
  accent: "#D9DDE8",
  accentSoft: "rgba(217, 221, 232, 0.10)",
  green: "#6EE7B7",
  greenSoft: "rgba(110, 231, 183, 0.16)",
  yellow: "#F4CF66",
  yellowSoft: "rgba(244, 207, 102, 0.16)",
  purple: "#BA9CFF",
  purpleSoft: "rgba(186, 156, 255, 0.16)",
  red: "#FB7185",
  redSoft: "rgba(251, 113, 133, 0.16)",
};

const fonts = `'IBM Plex Mono', 'JetBrains Mono', monospace`;
const fontDisplay = `'Space Grotesk', 'Satoshi', 'Syne', sans-serif`;
const MINT_PAYLOAD_STORAGE_KEY = "onchainpixel.mintPayload";

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
        animation: siteDrift 8s ease-in-out infinite;
        will-change: transform;
      }

      .site-pulse-glow {
        animation: sitePulseGlow 9s ease-in-out infinite;
      }

      .site-hover-lift {
        transition: transform 220ms ease, border-color 220ms ease, background 220ms ease, box-shadow 220ms ease;
      }

      .site-hover-lift:hover {
        transform: translateY(-4px);
        box-shadow: 0 24px 52px rgba(0, 0, 0, 0.26);
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

      @keyframes sitePulseGlow {
        0% { opacity: 0.82; }
        50% { opacity: 1; }
        100% { opacity: 0.82; }
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
    backdropFilter: "blur(14px)",
    boxShadow: "0 16px 48px rgba(0, 0, 0, 0.22)",
    transition: "transform 0.2s, border-color 0.2s, background 0.2s",
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

function FloatingNav({ page, setPage, wallet, onConnectWallet }) {
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
        <button
          onClick={() => setPage("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
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
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                borderRadius: 999,
                padding: "10px 16px",
                fontFamily: fonts,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.45,
                cursor: "pointer",
                transition: "all 0.2s",
                border: `1px solid ${page === item.id ? COLORS.borderStrong : COLORS.border}`,
                background: page === item.id ? COLORS.surfaceStrong : "transparent",
                color: page === item.id ? COLORS.text : COLORS.textMuted,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          onClick={onConnectWallet}
          style={{
            borderRadius: 999,
            padding: "11px 16px",
            minWidth: 154,
            border: `1px solid ${COLORS.borderStrong}`,
            cursor: "pointer",
            background: COLORS.surfaceStrong,
            color: COLORS.text,
            fontFamily: fonts,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.55,
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
        </button>
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
              minHeight: index === 0 ? 236 : 186,
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
    <FrostCard className={className} style={{ padding: 20, minHeight: 132, ...style }}>
      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, color: tones[tone], fontFamily: fontDisplay, fontSize: 30, fontWeight: 600, letterSpacing: -0.9 }}>
        {value}
      </div>
      {sub ? (
        <div style={{ marginTop: 10, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.6 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 24 }}>
          <div style={{ color: COLORS.accent, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" }}>ETH reserve</div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", marginTop: 14 }}>
            <div style={{ width: `${ethPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #7CB7F6, #BA9CFF)" }} />
          </div>
          <div style={{ marginTop: 12, color: COLORS.text, fontFamily: fontDisplay, fontSize: 26, fontWeight: 600 }}>
            {pool.ethBalance.toFixed(2)} ETH
          </div>
        </FrostCard>

        <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 24 }}>
          <div style={{ color: COLORS.green, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" }}>Inventory depth</div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", marginTop: 14 }}>
            <div style={{ width: `${nftPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #6EE7B7, #F4CF66)" }} />
          </div>
          <div style={{ marginTop: 12, color: COLORS.text, fontFamily: fontDisplay, fontSize: 26, fontWeight: 600 }}>
            {pool.poolNfts} NFTs
          </div>
        </FrostCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
        <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 24 }}>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Sell quote</div>
          <div style={{ marginTop: 8, color: COLORS.red, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{pool.sellPrice} ETH</div>
        </FrostCard>
        <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 24 }}>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Floor quote</div>
          <div style={{ marginTop: 8, color: COLORS.yellow, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{pool.floor} ETH</div>
        </FrostCard>
        <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 24 }}>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Ask quote</div>
          <div style={{ marginTop: 8, color: COLORS.green, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{pool.buyPrice} ETH</div>
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
  const ethUsd = pool.ethUsd || 2000;
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
        <button
          onClick={() => setPage("mint")}
          style={{
            padding: "13px 20px",
            borderRadius: 999,
            border: `1px solid ${COLORS.borderStrong}`,
            cursor: "pointer",
            background: COLORS.surfaceStrong,
            color: COLORS.text,
            fontFamily: fonts,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Open mint room
        </button>
        <button
          onClick={() => setPage("market")}
          style={{
            padding: "13px 20px",
            borderRadius: 999,
            border: `1px solid ${COLORS.borderStrong}`,
            cursor: "pointer",
            background: COLORS.surface,
            color: COLORS.text,
            fontFamily: fonts,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Browse market cards
        </button>
        <button
          onClick={() => setPage("staking")}
          style={{
            padding: "13px 20px",
            borderRadius: 999,
            border: `1px solid ${COLORS.borderStrong}`,
            cursor: "pointer",
            background: COLORS.purpleSoft,
            color: COLORS.purple,
            fontFamily: fonts,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Earn fees
        </button>
        <DataBadge isLive={isLive} error={poolError} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 26 }}>
        <MetricPanel className="site-reveal" style={revealStyle(360)} label="Floor" value={fmtEth(pool.floor)} sub={`$${(pool.floor * ethUsd).toFixed(2)} spot read`} tone="yellow" />
        <MetricPanel className="site-reveal" style={revealStyle(430)} label="Liquidity pool" value={fmtEth(pool.ethBalance, 2)} sub="Current reserve" tone="accent" />
        <MetricPanel className="site-reveal" style={revealStyle(500)} label="Treasury" value={pool.treasuryBalance != null ? fmtEth(pool.treasuryBalance, 3) : "10%"} sub="Buyback and burn lane" tone="purple" />
        <MetricPanel className="site-reveal" style={revealStyle(570)} label="Staked" value={pool.totalStaked != null ? `${pool.totalStaked} NFTs` : "—"} sub="Earning trade fees" tone="green" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 12, marginTop: 26 }}>
        <PoolViz className="site-reveal" style={revealStyle(620)} pool={pool} />
        <div style={{ display: "grid", gap: 12 }}>
          {features.map((feature, index) => (
            <FrostCard key={feature.title} className="site-reveal" style={{ padding: 22, ...revealStyle(680 + index * 70) }}>
              <Eyebrow tone={feature.tone}>Protocol note</Eyebrow>
              <div style={{ marginTop: 14, color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: -0.8 }}>
                {feature.title}
              </div>
              <div style={{ marginTop: 10, color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.75 }}>
                {feature.desc}
              </div>
            </FrostCard>
          ))}
        </div>
      </div>
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

function ConnectPrompt({ wallet, onConnectWallet }) {
  if (wallet?.account) return null;
  return (
    <button
      onClick={onConnectWallet}
      style={{
        width: "100%",
        padding: "12px 0",
        borderRadius: 999,
        border: `1px solid ${COLORS.border}`,
        cursor: "pointer",
        background: "transparent",
        color: COLORS.textMuted,
        fontFamily: fonts,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      Connect wallet first
    </button>
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
      <button
        onClick={() => switchToChain("11155111")}
        style={{
          padding: "6px 12px", borderRadius: 999, border: `1px solid ${COLORS.yellow}`,
          cursor: "pointer", background: "transparent", color: COLORS.yellow,
          fontFamily: fonts, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
        }}
      >
        Switch to Sepolia
      </button>
    </div>
  );
}

function MintPage({ wallet, onConnectWallet, appConfig, pool, isLive, poolError }) {
  const [payloadHex, setPayloadHex] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const routerAddress = appConfig?.routerAddress || "";
  const payloadBytes = ethers.utils.isHexString(payloadHex) ? ethers.utils.hexDataLength(payloadHex) : 0;
  const payloadValid = isValidMintPayload(payloadHex);
  const mintPriceLabel = isLive && pool.mintPriceEth != null
    ? `${pool.mintPriceEth} ETH`
    : "— ETH";

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

  async function handleMint() {
    if (!wallet?.provider || !wallet?.account) {
      setTxStatus("Connect wallet to mint.");
      onConnectWallet?.();
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
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "118px 18px 64px" }}>
      <FrostCard className="site-reveal" style={{ padding: 28, ...revealStyle(90) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: -0.9 }}>Mint</div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 4 }}>
              Router path — 60% pool, 10% treasury, 30% creator
            </div>
          </div>
          <DataBadge isLive={isLive} error={poolError} />
        </div>

        {/* Price + supply */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 }}>
          <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 20 }}>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Mint price</div>
            <div style={{ marginTop: 6, color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{mintPriceLabel}</div>
          </FrostCard>
          <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 20 }}>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Minted</div>
            <div style={{ marginTop: 6, color: COLORS.green, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{isLive ? pool.totalMinted.toLocaleString() : "—"}</div>
          </FrostCard>
          <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 20 }}>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Canvas</div>
            <div style={{ marginTop: 6, color: COLORS.purple, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>32x32</div>
          </FrostCard>
        </div>

        {/* Payload */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" }}>
              Pixel payload
            </div>
            <button
              onClick={() => setPayloadHex(readStoredMintPayload())}
              style={{
                padding: "5px 10px", borderRadius: 999, border: `1px solid ${COLORS.border}`,
                cursor: "pointer", background: "transparent", color: COLORS.textMuted,
                fontFamily: fonts, fontSize: 10, fontWeight: 600,
              }}
            >
              Pull from editor
            </button>
          </div>
          <textarea
            value={payloadHex}
            onChange={(e) => setPayloadHex(e.target.value.trim())}
            placeholder="0x...512-byte hex from Pixel Editor"
            style={{
              width: "100%", minHeight: 100, resize: "vertical",
              background: COLORS.surfaceStrong,
              border: `1px solid ${payloadValid || !payloadHex ? COLORS.border : COLORS.red}`,
              borderRadius: 14, padding: 12, color: COLORS.text,
              fontFamily: fonts, fontSize: 11, lineHeight: 1.6, outline: "none",
            }}
          />
          <div style={{ marginTop: 6, color: payloadValid ? COLORS.green : COLORS.textMuted, fontFamily: fonts, fontSize: 10 }}>
            {payloadHex
              ? payloadValid ? `Ready: ${payloadBytes} bytes` : `${payloadBytes} bytes (need 512)`
              : "Draw in the Pixel Editor first."}
          </div>
        </div>

        {/* Action */}
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <button
            onClick={handleMint}
            disabled={isSubmitting || !payloadValid}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 999,
              border: `1px solid ${payloadValid ? COLORS.borderStrong : COLORS.border}`,
              cursor: isSubmitting ? "progress" : payloadValid ? "pointer" : "not-allowed",
              background: payloadValid ? COLORS.surfaceStrong : COLORS.surface,
              color: payloadValid ? COLORS.text : COLORS.textDim,
              fontFamily: fonts, fontSize: 12, fontWeight: 700,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Minting..." : payloadValid ? `Mint for ${mintPriceLabel}` : "Draw pixel art first"}
          </button>
          <WrongChainBanner wallet={wallet} />
          <ConnectPrompt wallet={wallet} onConnectWallet={onConnectWallet} />
          <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
        </div>
      </FrostCard>
    </div>
  );
}

function MarketplacePage({ pool, isLive, wallet, onConnectWallet, appConfig, poolError }) {
  const [tab, setTab] = useState("buy");
  const [sellTokenId, setSellTokenId] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const routerAddress = appConfig?.routerAddress || "";
  const nftAddress = appConfig?.nftAddress || "";
  const ethUsd = pool.ethUsd || 2000;

  async function handleBuy() {
    if (!wallet?.provider || !wallet?.account) { onConnectWallet?.(); return; }
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
    if (!wallet?.provider || !wallet?.account) { onConnectWallet?.(); return; }
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
      {/* Metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MetricPanel className="site-reveal-soft" style={revealStyle(80)} label="Floor" value={fmtEth(pool.floor)} sub={`$${(pool.floor * ethUsd).toFixed(2)}`} tone="yellow" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(120)} label="Pool reserve" value={fmtEth(pool.ethBalance, 2)} sub={`${pool.poolNfts} NFTs in pool`} tone="accent" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(160)} label="Market state" value={pool.marketState || "—"} sub={`Sell: ${pool.canSell ? "open" : "closed"} · Buy: ${pool.canBuy ? "open" : "closed"}`} tone="green" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(200)} label="Coverage" value={fmtPct(pool.liqRatio)} sub="Reserve / EMC" tone="purple" />
      </div>

      <div style={{ marginTop: 18 }}>
        <PoolViz className="site-reveal" style={revealStyle(240)} pool={pool} />
      </div>

      {/* Tab bar */}
      <div className="site-reveal-soft" style={{ display: "flex", gap: 8, marginTop: 18, alignItems: "center", ...revealStyle(300) }}>
        {["buy", "sell"].map((type) => (
          <button
            key={type}
            onClick={() => { setTab(type); setTxStatus(""); setTxHash(""); }}
            style={{
              padding: "11px 20px", borderRadius: 999, cursor: "pointer",
              fontFamily: fonts, fontSize: 11, fontWeight: 600, textTransform: "capitalize",
              border: `1px solid ${tab === type ? COLORS.borderStrong : COLORS.border}`,
              background: tab === type ? (type === "buy" ? COLORS.greenSoft : COLORS.redSoft) : COLORS.surface,
              color: tab === type ? (type === "buy" ? COLORS.green : COLORS.red) : COLORS.textMuted,
            }}
          >
            {type === "buy" ? "Buy from pool" : "Sell to pool"}
          </button>
        ))}
        <DataBadge isLive={isLive} error={poolError} />
      </div>

      {/* Action panel */}
      <FrostCard className="site-reveal" style={{ padding: 24, marginTop: 14, ...revealStyle(340) }}>
        {tab === "buy" ? (
          <div>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
              Buy from pool
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Buys the next available NFT from pool inventory at the current ask price (floor + 20% spread + 2.5% fee).
              {!pool.canBuy && (
                <span style={{ color: COLORS.yellow }}> Pool buying is currently disabled — requires Stabilization state with inventory.</span>
              )}
            </div>

            <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 20, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12 }}>Buy price</span>
                <span style={{ color: COLORS.green, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
                  {pool.buyPrice ? fmtEth(pool.buyPrice) : "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12 }}>Available in pool</span>
                <span style={{ color: COLORS.text, fontFamily: fonts, fontSize: 12, fontWeight: 600 }}>{pool.poolNfts}</span>
              </div>
            </FrostCard>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <button
                onClick={handleBuy}
                disabled={isSubmitting || !pool.canBuy}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 999,
                  border: `1px solid ${pool.canBuy ? COLORS.borderStrong : COLORS.border}`,
                  cursor: isSubmitting ? "progress" : pool.canBuy ? "pointer" : "not-allowed",
                  background: pool.canBuy ? COLORS.greenSoft : COLORS.surface,
                  color: pool.canBuy ? COLORS.green : COLORS.textDim,
                  fontFamily: fonts, fontSize: 12, fontWeight: 700,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Buying..." : pool.canBuy ? `Buy for ~${fmtEth(pool.buyPrice)}` : "Buy disabled"}
              </button>
              <WrongChainBanner wallet={wallet} />
          <ConnectPrompt wallet={wallet} onConnectWallet={onConnectWallet} />
              <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
              Sell to pool
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Sell your NFT into the pool at the current floor bid minus 2.5% fee. The router handles approval and transfer.
              {!pool.canSell && (
                <span style={{ color: COLORS.yellow }}> Pool selling is currently disabled — requires post-launch period and sufficient coverage.</span>
              )}
            </div>

            <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 20, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12 }}>Sell price</span>
                <span style={{ color: COLORS.red, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
                  {pool.sellPrice ? fmtEth(pool.sellPrice) : "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12 }}>Net payout (after 2.5% fee)</span>
                <span style={{ color: COLORS.text, fontFamily: fonts, fontSize: 12, fontWeight: 600 }}>
                  {pool.sellPrice ? fmtEth(pool.sellPrice * 0.975) : "—"}
                </span>
              </div>
            </FrostCard>

            <div style={{ marginTop: 16 }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 }}>
                Token ID to sell
              </div>
              <input
                type="number"
                min="0"
                value={sellTokenId}
                onChange={(e) => setSellTokenId(e.target.value)}
                placeholder="e.g. 42"
                style={{
                  width: "100%", padding: 12, background: COLORS.surfaceStrong,
                  border: `1px solid ${COLORS.border}`, borderRadius: 14,
                  color: COLORS.text, fontFamily: fonts, fontSize: 13, outline: "none",
                }}
              />
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <button
                onClick={handleSell}
                disabled={isSubmitting || !pool.canSell}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 999,
                  border: `1px solid ${pool.canSell ? COLORS.borderStrong : COLORS.border}`,
                  cursor: isSubmitting ? "progress" : pool.canSell ? "pointer" : "not-allowed",
                  background: pool.canSell ? COLORS.redSoft : COLORS.surface,
                  color: pool.canSell ? COLORS.red : COLORS.textDim,
                  fontFamily: fonts, fontSize: 12, fontWeight: 700,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Selling..." : pool.canSell ? `Sell for ~${fmtEth(pool.sellPrice)}` : "Sell disabled"}
              </button>
              <WrongChainBanner wallet={wallet} />
          <ConnectPrompt wallet={wallet} onConnectWallet={onConnectWallet} />
              <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
            </div>
          </div>
        )}
      </FrostCard>
    </div>
  );
}

function StakingPage({ pool, isLive, wallet, onConnectWallet, appConfig, poolError }) {
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stakeTokenId, setStakeTokenId] = useState("");
  const [unstakeTokenId, setUnstakeTokenId] = useState("");
  const [userStaked, setUserStaked] = useState([]);
  const [pendingFees, setPendingFees] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

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

  async function handleStake() {
    if (!wallet?.provider || !wallet?.account) { onConnectWallet?.(); return; }
    if (!poolAddress || !nftAddress) { setTxStatus("Pool or NFT address not set."); return; }
    const chainErr = checkChain(wallet);
    if (chainErr) { setTxStatus(chainErr); return; }

    const tokenId = parseInt(stakeTokenId, 10);
    if (isNaN(tokenId) || tokenId < 0) { setTxStatus("Enter a valid token ID."); return; }

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
      setStakeTokenId("");
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Stake failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnstake(tokenId) {
    if (!wallet?.provider || !wallet?.account) { onConnectWallet?.(); return; }
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
    if (!wallet?.provider || !wallet?.account) { onConnectWallet?.(); return; }
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <MetricPanel className="site-reveal-soft" style={revealStyle(80)} label="Total staked" value={pool.totalStaked ?? "—"} sub="NFTs earning fees" tone="purple" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(120)} label="Your staked" value={loadingUser ? "..." : userStaked.length} sub={userStaked.length ? `IDs: ${userStaked.join(", ")}` : "None staked"} tone="accent" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(160)} label="Pending fees" value={hasPending ? formatEth(pendingFees) : "0 ETH"} sub={hasPending ? `~$${(Number(ethers.utils.formatEther(pendingFees)) * (pool.ethUsd || 2000)).toFixed(2)}` : "No fees to claim"} tone="green" />
      </div>

      {/* Claim fees card */}
      <FrostCard className="site-reveal" style={{ padding: 24, marginTop: 18, ...revealStyle(200) }}>
        <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
          Claim staking rewards
        </div>
        <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
          Stakers earn a share of trade fees (10% of each sell). Fees accumulate automatically and can be claimed at any time. Unstaking also pays out pending rewards.
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <button
            onClick={handleClaim}
            disabled={isSubmitting || !hasPending}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 999,
              border: `1px solid ${hasPending ? COLORS.borderStrong : COLORS.border}`,
              cursor: isSubmitting ? "progress" : hasPending ? "pointer" : "not-allowed",
              background: hasPending ? COLORS.greenSoft : COLORS.surface,
              color: hasPending ? COLORS.green : COLORS.textDim,
              fontFamily: fonts, fontSize: 12, fontWeight: 700,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Claiming..." : hasPending ? `Claim ${formatEth(pendingFees)}` : "No fees to claim"}
          </button>
        </div>
      </FrostCard>

      {/* Stake / Unstake cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        {/* Stake card */}
        <FrostCard className="site-reveal" style={{ padding: 24, ...revealStyle(260) }}>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
            Stake NFT
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
            Lock your NFT in the pool to earn a share of trading fees.
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 }}>
              Token ID
            </div>
            <input
              type="number"
              min="0"
              value={stakeTokenId}
              onChange={(e) => setStakeTokenId(e.target.value)}
              placeholder="e.g. 42"
              style={{
                width: "100%", padding: 12, background: COLORS.surfaceStrong,
                border: `1px solid ${COLORS.border}`, borderRadius: 14,
                color: COLORS.text, fontFamily: fonts, fontSize: 13, outline: "none",
              }}
            />
          </div>
          <button
            onClick={handleStake}
            disabled={isSubmitting}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 999, marginTop: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              cursor: isSubmitting ? "progress" : "pointer",
              background: COLORS.purpleSoft,
              color: COLORS.purple,
              fontFamily: fonts, fontSize: 12, fontWeight: 700,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Staking..." : "Stake"}
          </button>
        </FrostCard>

        {/* Unstake card */}
        <FrostCard className="site-reveal" style={{ padding: 24, ...revealStyle(300) }}>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
            Unstake NFT
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
            Withdraw your NFT. Pending fees are paid out automatically.
          </div>

          {userStaked.length > 0 ? (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {userStaked.map((tid) => (
                <button
                  key={tid}
                  onClick={() => handleUnstake(tid)}
                  disabled={isSubmitting}
                  style={{
                    width: "100%", padding: "11px 16px", borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    cursor: isSubmitting ? "progress" : "pointer",
                    background: COLORS.surface,
                    color: COLORS.text,
                    fontFamily: fonts, fontSize: 12, fontWeight: 600,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  <span>Token #{tid}</span>
                  <span style={{ color: COLORS.red, fontSize: 11 }}>Unstake</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <input
                type="number"
                min="0"
                value={unstakeTokenId}
                onChange={(e) => setUnstakeTokenId(e.target.value)}
                placeholder="Token ID"
                style={{
                  width: "100%", padding: 12, background: COLORS.surfaceStrong,
                  border: `1px solid ${COLORS.border}`, borderRadius: 14,
                  color: COLORS.text, fontFamily: fonts, fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={() => {
                  const tid = parseInt(unstakeTokenId, 10);
                  if (!isNaN(tid) && tid >= 0) handleUnstake(tid);
                  else setTxStatus("Enter a valid token ID.");
                }}
                disabled={isSubmitting}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 999, marginTop: 10,
                  border: `1px solid ${COLORS.border}`,
                  cursor: isSubmitting ? "progress" : "pointer",
                  background: COLORS.redSoft,
                  color: COLORS.red,
                  fontFamily: fonts, fontSize: 12, fontWeight: 700,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Unstaking..." : "Unstake"}
              </button>
            </div>
          )}
        </FrostCard>
      </div>

      {/* Status */}
      <div style={{ marginTop: 14 }}>
        <ConnectPrompt wallet={wallet} onConnectWallet={onConnectWallet} />
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

export default function OnchainPixelSite({ appConfig, wallet, onConnectWallet }) {
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
      <FloatingNav page={page} setPage={setPage} wallet={wallet} onConnectWallet={onConnectWallet} />
      {page === "home" && <HomePage setPage={setPage} pool={pool} isLive={isLive} poolError={poolError} />}
      {page === "mint" && <MintPage wallet={wallet} onConnectWallet={onConnectWallet} appConfig={appConfig} pool={pool} isLive={isLive} poolError={poolError} />}
      {page === "market" && <MarketplacePage pool={pool} isLive={isLive} wallet={wallet} onConnectWallet={onConnectWallet} appConfig={appConfig} poolError={poolError} />}
      {page === "staking" && <StakingPage pool={pool} isLive={isLive} wallet={wallet} onConnectWallet={onConnectWallet} appConfig={appConfig} poolError={poolError} />}
    </div>
  );
}
