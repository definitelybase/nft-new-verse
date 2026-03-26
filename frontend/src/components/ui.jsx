import React from "react";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { explorerTxUrl, getTargetChainId, getTargetChainLabel, shortAddress } from "../utils/helpers";
import { GlowCard } from "../GlowCard";
import { MetalButton } from "../MetalButton";
import { ThemeSwitch } from "../ThemeSwitch";

export function SiteMotionStyles() {
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

export function FrostCard({ children, style, hoverable = false, className = "" }) {
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

export function Eyebrow({ children, tone = "accent" }) {
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

export function PixelAvatar({ size = 48, seed = 0 }) {
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
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      let c = bg;
      if (y <= 1 && x >= 2 && x <= 5) c = hair;
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

export function TokenGrid({ title, tokens, selectedTokenId, onSelect, emptyLabel, loading, tone = "accent" }) {
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

export function DataBadge({ isLive, error }) {
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

export function TxStatusBar({ txStatus, txHash, chainId }) {
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

async function switchToChain(appConfig) {
  if (!window.ethereum) return;
  const targetChainId = getTargetChainId(appConfig);
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${Number(targetChainId).toString(16)}` }],
    });
  } catch {
    // ignore unsupported/rejected requests
  }
}

export function WrongChainBanner({ wallet, appConfig }) {
  const targetChainId = getTargetChainId(appConfig);
  const chainErr = wallet?.chainId && wallet.chainId !== targetChainId
    ? `Wrong network (chainId ${wallet.chainId}). Switch to ${getTargetChainLabel(appConfig)}.`
    : null;
  if (!chainErr || !wallet?.account) return null;
  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: 14,
        marginBottom: 12,
        background: COLORS.yellowSoft,
        border: `1px solid ${COLORS.yellow}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span style={{ color: COLORS.yellow, fontFamily: fonts, fontSize: 11 }}>{chainErr}</span>
      <MetalButton
        onClick={() => switchToChain(appConfig)}
        tone="yellow"
        size="xs"
        style={{
          minHeight: 30,
          padding: "6px 12px",
          whiteSpace: "nowrap",
        }}
      >
        Switch to {getTargetChainLabel(appConfig)}
      </MetalButton>
    </div>
  );
}

export function FloatingNav({ page, setPage, wallet, onConnectWallet, themeMode, onToggleTheme, targetChainId }) {
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
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: wallet.chainId === targetChainId ? COLORS.green : COLORS.yellow,
                }}
              />
              {shortAddress(wallet.account)}
            </span>
          ) : "Connect Wallet"}
        </MetalButton>
      </FrostCard>
    </header>
  );
}

export function MetricPanel({ label, value, sub, tone = "text", className = "", style }) {
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

export function PoolViz({ pool, className = "", style, fmtEth }) {
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
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Listing ref</div>
          <div style={{ marginTop: 8, color: COLORS.green, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{pool.listingPrice} ETH</div>
        </FrostCard>
      </div>
    </FrostCard>
  );
}
