import React, { useMemo } from "react";
import { MetalButton } from "../MetalButton";
import { useThemeMode } from "../ThemeModeContext";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { COLLECTION_SUPPLY, FEATURED_COLLECTION_IDS } from "../utils/generatedCollection";
import { driftStyle, fmtEth, fmtPct, revealStyle } from "../utils/helpers";
import { DataBadge, Eyebrow, FrostCard } from "../components/ui";

/* ── pixel mosaic grid (right side of hero) ── */
function PixelMosaic() {
  // Build a 10x10 grid of collection images, shuffled
  const ids = useMemo(() => {
    const all = Array.from({ length: Math.min(100, COLLECTION_SUPPLY) }, (_, i) => i);
    // Deterministic shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = (i * 7 + 13) % (i + 1);
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(10, 1fr)",
        gap: 3,
        width: "100%",
        maxWidth: 600,
        aspectRatio: "1 / 1",
        maskImage: "radial-gradient(ellipse 80% 80% at 60% 50%, black 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 60% 50%, black 40%, transparent 100%)",
        opacity: 0.85,
      }}
    >
      {ids.map((id, i) => (
        <div
          key={i}
          className="site-reveal-soft"
          style={{
            borderRadius: 4,
            overflow: "hidden",
            aspectRatio: "1",
            ...revealStyle(200 + i * 15),
          }}
        >
          <img
            src={`/collection/images/${id}.svg`}
            alt=""
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              imageRendering: "pixelated",
              display: "block",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── bottom metric pill with mini spark bar ── */
function MetricPill({ label, value, tone, pct }) {
  return (
    <div style={{
      padding: "14px 20px",
      borderRadius: 20,
      border: `1px solid ${COLORS.border}`,
      background: "rgba(255,255,255,0.03)",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minWidth: 140,
      flex: "1 1 0",
    }}>
      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: tone || COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
        {value}
      </div>
      {pct != null && (
        <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 999, background: tone || COLORS.accent, opacity: 0.7 }} />
        </div>
      )}
    </div>
  );
}

/* ── SVG donut chart for revenue split ── */
function RevenueDonut({ segments, size = 180 }) {
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const dashLen = (seg.pct / 100) * circ;
        const dashOffset = -offset;
        offset += dashLen;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={22}
            strokeDasharray={`${dashLen} ${circ - dashLen}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center", opacity: 0.85 }}
          />
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={COLORS.text} fontFamily={fontDisplay} fontSize="20" fontWeight="600">
        Revenue
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={COLORS.textMuted} fontFamily={fonts} fontSize="10">
        per mint split
      </text>
    </svg>
  );
}

/* ── market state visual card ── */
function MarketStateCard({ state, dot, desc, icon, active }) {
  return (
    <div style={{
      padding: 20,
      borderRadius: 20,
      border: `1px solid ${active ? dot : COLORS.border}`,
      background: active ? `${dot}08` : "rgba(255,255,255,0.03)",
      transition: "border-color 300ms ease, background 300ms ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: `${dot}18`,
          display: "grid",
          placeItems: "center",
          fontSize: 16,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, boxShadow: active ? `0 0 8px ${dot}` : "none" }} />
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>
              {state}
            </div>
          </div>
          {active && (
            <div style={{ color: dot, fontFamily: fonts, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginTop: 2, marginLeft: 15 }}>
              Current state
            </div>
          )}
        </div>
      </div>
      <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.75 }}>
        {desc}
      </div>
    </div>
  );
}

/* ── protocol feature card ── */
function FeatureCard({ icon, title, desc, tone, delay = 0 }) {
  return (
    <FrostCard
      className="site-reveal"
      style={{
        padding: 24,
        background: COLORS.surfaceStrong,
        minHeight: 180,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        ...revealStyle(delay),
      }}
    >
      <div style={{ color: tone, fontFamily: fonts, fontSize: 24, marginBottom: 12 }}>{icon}</div>
      <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: -0.5 }}>
        {title}
      </div>
      <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.75 }}>
        {desc}
      </div>
    </FrostCard>
  );
}

export default function HomePage({ setPage, pool, isLive, poolError }) {
  const themeMode = useThemeMode();
  const isLight = themeMode === "light";

  return (
    <div style={{ width: "100%", margin: 0, padding: 0 }}>
      {/* ════════ HERO SECTION ════════ */}
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          padding: "120px 48px 60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 60% 60% at 70% 40%, rgba(124,86,216,0.08), transparent 70%), radial-gradient(ellipse 40% 50% at 20% 80%, rgba(29,179,122,0.05), transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Floating particles */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {[
            { top: "15%", left: "30%", size: 3, delay: 0, dur: 12 },
            { top: "25%", left: "45%", size: 2, delay: 2, dur: 10 },
            { top: "60%", left: "20%", size: 2.5, delay: 4, dur: 14 },
            { top: "70%", left: "55%", size: 2, delay: 1, dur: 11 },
            { top: "40%", left: "80%", size: 3, delay: 3, dur: 13 },
          ].map((p, i) => (
            <div
              key={i}
              className="site-drift"
              style={{
                position: "absolute",
                top: p.top,
                left: p.left,
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.35)",
                ...driftStyle(p.delay * 1000, p.dur),
              }}
            />
          ))}
        </div>

        {/* Left: text content */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 620 }}>
          {/* "New" badge */}
          <div
            className="site-reveal-soft"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px 8px 10px",
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,0.04)",
              marginBottom: 32,
              ...revealStyle(100),
            }}
          >
            <span style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: COLORS.green,
              color: "#000",
              fontFamily: fonts,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}>
              Live
            </span>
            <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12 }}>
              Genesis collection minting on Ethereum
            </span>
          </div>

          {/* Hero headline */}
          <h1
            className="site-reveal"
            style={{
              fontFamily: fontDisplay,
              fontSize: "clamp(42px, 6.5vw, 82px)",
              lineHeight: 0.95,
              fontWeight: 600,
              letterSpacing: -3,
              margin: 0,
              color: COLORS.text,
              ...revealStyle(180),
            }}
          >
            On-Chain Pixels<br />
            <span style={{ color: COLORS.textMuted }}>With Built-In</span><br />
            <span style={{
              background: "linear-gradient(135deg, #B39DDB, #F48FB1, #FFCC80, #A5D6A7, #90CAF9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Liquidity
            </span>
          </h1>

          {/* Subheading */}
          <p
            className="site-reveal-soft"
            style={{
              margin: "24px 0 0",
              maxWidth: 480,
              color: COLORS.textMuted,
              fontFamily: fonts,
              fontSize: 14,
              lineHeight: 1.8,
              ...revealStyle(280),
            }}
          >
            Fully on-chain pixel art backed by a reserve pool. Every mint seeds floor liquidity.
            Premium pricing stays in the native marketplace while the protocol handles the floor lane.
          </p>

          {/* CTAs */}
          <div
            className="site-reveal-soft"
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginTop: 36,
              ...revealStyle(360),
            }}
          >
            <MetalButton
              onClick={() => setPage("mint")}
              tone="accent"
              active
              size="lg"
              style={{
                padding: "16px 32px",
                fontSize: 15,
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              Mint NFT &nbsp;&#x2197;
            </MetalButton>
            <MetalButton
              onClick={() => setPage("market")}
              tone="ghost"
              size="lg"
              style={{
                padding: "16px 24px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Explore collection &nbsp;&#x25B6;
            </MetalButton>
          </div>
        </div>

        {/* Right: pixel mosaic */}
        <div
          className="site-reveal"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            ...revealStyle(200),
          }}
        >
          <PixelMosaic />
        </div>

        {/* Bottom metrics bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "20px 48px",
            borderTop: `1px solid ${COLORS.border}`,
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            className="site-reveal-soft"
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "space-between",
              flexWrap: "wrap",
              ...revealStyle(500),
            }}
          >
            <MetricPill label="Floor price" value={fmtEth(pool.floor)} tone={COLORS.yellow} />
            <MetricPill label="Total minted" value={pool.totalMinted ?? "—"} tone={COLORS.accent} pct={pool.totalMinted ? Math.min((pool.totalMinted / 1000) * 100, 100) : 0} />
            <MetricPill label="Pool reserve" value={fmtEth(pool.ethBalance, 2)} tone={COLORS.green} pct={pool.ethBalance ? Math.min(pool.ethBalance * 10, 100) : 0} />
            <MetricPill label="Market state" value={pool.marketState || "—"} tone={COLORS.purple} />
            <MetricPill label="Staked" value={pool.totalStaked ?? "—"} tone="#D4497A" pct={pool.totalMinted > 0 ? (pool.totalStaked / pool.totalMinted) * 100 : 0} />
          </div>
        </div>
      </div>

      {/* ════════ PROTOCOL OVERVIEW ════════ */}
      <div style={{ padding: "64px 48px 80px" }}>
        {/* Section header */}
        <div
          className="site-reveal"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
            ...revealStyle(100),
          }}
        >
          <div>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 36, fontWeight: 600, letterSpacing: -1.2 }}>
              How it works
            </div>
            <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 13, lineHeight: 1.7, maxWidth: 560 }}>
              Three core mechanics that make the protocol tick. No emissions, no token, no governance — just on-chain pixel art with a self-sustaining floor.
            </div>
          </div>
          <DataBadge isLive={isLive} error={poolError} />
        </div>

        {/* ── Liquidity loading bar visualization ── */}
        <FrostCard
          className="site-reveal"
          style={{ padding: 28, marginBottom: 24, overflow: "hidden", ...revealStyle(150) }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: -0.8 }}>
                Reserve liquidity
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 4 }}>
                Every mint adds ETH to the reserve pool. The bar fills as coverage grows.
              </div>
            </div>
            <div style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: COLORS.greenSoft,
              color: COLORS.green,
              fontFamily: fonts, fontSize: 11, fontWeight: 700,
            }}>
              {pool.ethBalance > 0 ? `${Number(pool.ethBalance).toFixed(3)} ETH` : "Preview"}
            </div>
          </div>

          {/* Main liquidity bar */}
          <div style={{ position: "relative", height: 40, borderRadius: 20, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
            {/* Animated fill */}
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0,
              width: `${pool.ethBalance > 0 ? Math.min((pool.ethBalance / (pool.ethBalance + 5)) * 100, 95) : 35}%`,
              borderRadius: 20,
              background: "linear-gradient(90deg, #7CB7F6, #AE8BFF, #6EE7B7)",
              transition: "width 1.5s cubic-bezier(0.22, 1, 0.36, 1)",
            }}>
              {/* Shimmer animation */}
              <div style={{
                position: "absolute", inset: 0, borderRadius: 20,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 2.5s ease-in-out infinite",
              }} />
            </div>
            {/* Labels inside bar */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 16px",
            }}>
              <span style={{ color: "rgba(255,255,255,0.9)", fontFamily: fontDisplay, fontSize: 13, fontWeight: 600, zIndex: 1 }}>
                Pool reserve
              </span>
              <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: fonts, fontSize: 11, zIndex: 1 }}>
                {pool.liqRatio > 0 ? `${(pool.liqRatio * 100).toFixed(0)}% coverage` : "Growing..."}
              </span>
            </div>
          </div>

          {/* Mini breakdown bars */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
            {[
              { label: "Floor bid", value: fmtEth(pool.floor), color: "#F4CF66", pct: pool.floor > 0 ? Math.min((pool.floor / 0.05) * 100, 100) : 20 },
              { label: "Sell quote", value: fmtEth(pool.sellPrice), color: "#F48FB1", pct: pool.sellPrice > 0 ? Math.min((pool.sellPrice / 0.05) * 100, 100) : 15 },
              { label: "Listing ref", value: fmtEth(pool.listingPrice), color: "#6EE7B7", pct: pool.listingPrice > 0 ? Math.min((pool.listingPrice / 0.1) * 100, 100) : 30 },
            ].map((b) => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{b.label}</span>
                  <span style={{ color: b.color, fontFamily: fontDisplay, fontSize: 12, fontWeight: 600 }}>{b.value}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  <div style={{
                    width: `${b.pct}%`, height: "100%", borderRadius: 999,
                    background: b.color, opacity: 0.7,
                    transition: "width 1.2s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </FrostCard>

        {/* Revenue split — donut + legend */}
        <FrostCard
          className="site-reveal-soft"
          style={{ padding: 28, marginBottom: 24, ...revealStyle(200) }}
        >
          <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
            <RevenueDonut
              size={180}
              segments={[
                { pct: 60, color: "#7CB7F6" },
                { pct: 10, color: "#AE8BFF" },
                { pct: 30, color: "#F4CF66" },
              ]}
            />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, minWidth: 280 }}>
              {[
                { label: "Pool reserve", value: "60%", sub: "Every mint seeds floor liquidity", color: "#7CB7F6" },
                { label: "Treasury", value: "10%", sub: "Buyback and cleanup fund", color: "#AE8BFF" },
                { label: "Protocol ops", value: "30%", sub: "Rollout and maintenance", color: "#F4CF66" },
                { label: "Trade fee", value: "2.5%", sub: "Split to stakers, pool, treasury", color: "#6EE7B7" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 4, height: 36, borderRadius: 999, background: item.color, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>
                      {item.value}
                    </div>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                      {item.label}
                    </div>
                    <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>
                      {item.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FrostCard>

        {/* Feature cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <FeatureCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.35"/>
              </svg>
            }
            title="SSTORE2 on-chain art"
            desc="Images live as packed pixel data directly in Ethereum storage. No IPFS, no external hosting — chain-rendered SVGs from raw bytes."
            tone={COLORS.accent}
            delay={300}
          />
          <FeatureCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L3 21h18L12 3z" fill="currentColor" opacity="0.2"/>
                <path d="M12 7l-5 10h10L12 7z" fill="currentColor" opacity="0.7"/>
                <circle cx="12" cy="14" r="2" fill="currentColor"/>
              </svg>
            }
            title="Reserve-backed floor"
            desc="The pool quotes a floor bid only when reserve coverage and market-state rules allow it. Not a permanent guarantee — a rule-based reserve lane."
            tone={COLORS.green}
            delay={370}
          />
          <FeatureCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 12l10 10 10-10L12 2z" fill="currentColor" opacity="0.2"/>
                <path d="M12 6L6 12l6 6 6-6-6-6z" fill="currentColor" opacity="0.6"/>
                <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
              </svg>
            }
            title="Native marketplace"
            desc="Premium pricing stays in open discovery. Protocol inventory reaches the market only after stabilization thresholds. Offers, expiration, and on-chain activity."
            tone={COLORS.purple}
            delay={440}
          />
        </div>

        {/* Market state explanation */}
        <FrostCard
          className="site-reveal"
          style={{
            padding: 28,
            marginTop: 24,
            ...revealStyle(500),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ color: "#E8853A", fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: -0.8 }}>
                Market states
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 4 }}>
                Protocol adapts behavior based on supply/demand dynamics
              </div>
            </div>
            <Eyebrow tone="purple">Adaptive protocol</Eyebrow>
          </div>

          {/* State flow arrow visualization */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20 }}>
            {["Expansion", "Stabilization", "Weak demand"].map((s, i) => {
              const colors = ["#76AEEB", "#AE8BFF", "#D6B861"];
              const isActive = pool.marketState?.toLowerCase() === s.toLowerCase();
              return (
                <React.Fragment key={s}>
                  <div style={{
                    padding: "5px 14px",
                    borderRadius: 999,
                    background: isActive ? `${colors[i]}22` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? colors[i] : COLORS.border}`,
                    color: isActive ? colors[i] : COLORS.textMuted,
                    fontFamily: fonts,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    transition: "all 300ms ease",
                  }}>
                    {isActive && <span style={{ marginRight: 6 }}>&#x25CF;</span>}
                    {s}
                  </div>
                  {i < 2 && (
                    <svg width="20" height="10" viewBox="0 0 20 10" style={{ opacity: 0.3 }}>
                      <path d="M0 5h14m-4-4l4 4-4 4" stroke={COLORS.textMuted} strokeWidth="1.5" fill="none"/>
                    </svg>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              {
                state: "Expansion",
                dot: "#76AEEB",
                icon: "\u2197",
                desc: "Strong demand. Sell-to-pool closed to protect reserve. Protocol lets the market price naturally.",
              },
              {
                state: "Stabilization",
                dot: "#AE8BFF",
                icon: "\u2194",
                desc: "Balanced market. Sell lane opens if coverage holds. Protocol can release inventory to the marketplace.",
              },
              {
                state: "Weak demand",
                dot: "#D6B861",
                icon: "\u2198",
                desc: "Low activity. Treasury buyback activates when coverage is 2x+. Stale inventory gets burned.",
              },
            ].map((item) => (
              <MarketStateCard
                key={item.state}
                state={item.state}
                dot={item.dot}
                icon={item.icon}
                desc={item.desc}
                active={pool.marketState?.toLowerCase() === item.state.toLowerCase()}
              />
            ))}
          </div>
        </FrostCard>

        {/* Staking & Marketplace info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 24 }}>
          <FrostCard
            className="site-reveal"
            style={{ padding: 28, ...revealStyle(600) }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 14,
                background: "linear-gradient(135deg, #D4497A22, #D4497A11)",
                border: "1px solid #D4497A33",
                display: "grid", placeItems: "center",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v8l6 4-6 4v4" stroke="#D4497A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 10L6 6" stroke="#D4497A" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                </svg>
              </div>
              <div style={{ color: "#D4497A", fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: -0.8 }}>
                Weighted staking
              </div>
            </div>

            {/* Lock tier mini chart */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { tier: "No lock", mult: "1x", h: 25 },
                { tier: "7 days", mult: "1.25x", h: 35 },
                { tier: "30 days", mult: "1.5x", h: 50 },
                { tier: "90 days", mult: "2x", h: 70 },
              ].map((t) => (
                <div key={t.tier} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: "100%", height: t.h, borderRadius: 8,
                    background: "linear-gradient(180deg, #D4497A55, #D4497A22)",
                    border: "1px solid #D4497A33",
                  }} />
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 12, fontWeight: 600 }}>{t.mult}</div>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 9, textAlign: "center" }}>{t.tier}</div>
                </div>
              ))}
            </div>

            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.8 }}>
              Stake NFTs to earn 10% of all trade fees. Lock longer for higher weight. Batch ops supported.
            </div>
            <MetalButton
              onClick={() => setPage("staking")}
              tone="purple"
              active
              size="md"
              style={{ marginTop: 16, cursor: "pointer" }}
            >
              Go to staking &nbsp;&#x2192;
            </MetalButton>
          </FrostCard>

          <FrostCard
            className="site-reveal"
            style={{ padding: 28, ...revealStyle(670) }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 14,
                background: "linear-gradient(135deg, #6EE7B722, #6EE7B711)",
                border: "1px solid #6EE7B733",
                display: "grid", placeItems: "center",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="10" width="4" height="10" rx="1" fill="#6EE7B7" opacity="0.4"/>
                  <rect x="10" y="6" width="4" height="14" rx="1" fill="#6EE7B7" opacity="0.6"/>
                  <rect x="17" y="3" width="4" height="17" rx="1" fill="#6EE7B7" opacity="0.85"/>
                </svg>
              </div>
              <div style={{ color: COLORS.green, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: -0.8 }}>
                On-chain marketplace
              </div>
            </div>

            {/* Feature bullets */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Listings", icon: "\u2696" },
                { label: "Token offers", icon: "\u2709" },
                { label: "Collection offers", icon: "\u2605" },
                { label: "Activity log", icon: "\u2630" },
              ].map((f) => (
                <div key={f.label} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 12,
                  background: "rgba(110,231,183,0.05)",
                  border: `1px solid ${COLORS.border}`,
                }}>
                  <span style={{ fontSize: 14 }}>{f.icon}</span>
                  <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11 }}>{f.label}</span>
                </div>
              ))}
            </div>

            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.8 }}>
              Native marketplace with expiration, offers, and full on-chain activity. Premium pricing stays here.
            </div>
            <MetalButton
              onClick={() => setPage("market")}
              tone="green"
              active
              size="md"
              style={{ marginTop: 16, cursor: "pointer" }}
            >
              Explore market &nbsp;&#x2192;
            </MetalButton>
          </FrostCard>
        </div>
      </div>
    </div>
  );
}
