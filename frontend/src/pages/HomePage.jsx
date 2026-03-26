import React from "react";
import { MetalButton } from "../MetalButton";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { FEATURED_COLLECTION_IDS } from "../utils/generatedCollection";
import { driftStyle, fmtEth, revealStyle } from "../utils/helpers";
import { DataBadge, Eyebrow, FrostCard } from "../components/ui";

function HeroGallery({ pool }) {
  const tiles = [
    { title: "Permanent art", desc: "SSTORE2-backed data", image: `/collection/images/${FEATURED_COLLECTION_IDS[0]}.svg` },
    { title: "Live market", desc: "Pool-aware pricing", image: `/collection/images/${FEATURED_COLLECTION_IDS[1]}.svg` },
    { title: "Instant exits", desc: "Floor-liquidity thesis", image: `/collection/images/${FEATURED_COLLECTION_IDS[2]}.svg` },
    { title: "On-chain render", desc: "SVG output", image: `/collection/images/${FEATURED_COLLECTION_IDS[3]}.svg` },
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
            key={tile.image}
            hoverable
            className="site-reveal site-hover-lift"
            style={{
              padding: 18,
              minHeight: 206,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              ...revealStyle(140 + index * 70),
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: "100%",
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    color: COLORS.text,
                    fontFamily: fontDisplay,
                    fontSize: 18,
                    fontWeight: 600,
                    lineHeight: 1.1,
                    textAlign: "left",
                  }}
                >
                  {tile.title}
                </div>
                <div
                  style={{
                    color: COLORS.textMuted,
                    fontFamily: fonts,
                    fontSize: 13,
                    lineHeight: 1.35,
                    textAlign: "left",
                  }}
                >
                  {tile.desc}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                <div className="site-drift" style={driftStyle(index * 360, 7 + index)}>
                  <div
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 22,
                      border: `1px solid ${COLORS.border}`,
                      background: "rgba(255,255,255,0.04)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 28px rgba(0,0,0,0.12)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={tile.image}
                      alt={tile.desc}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        imageRendering: "pixelated",
                        display: "block",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </FrostCard>
        ))}
      </div>
    </div>
  );
}

function LiquiditySystemOverview({ className = "", style }) {
  const splitCards = [
    { label: "Pool reserve", value: "60%", sub: "Every mint seeds floor liquidity.", tone: COLORS.accent },
    { label: "Treasury lane", value: "10%", sub: "Buyback and burn pressure valve.", tone: COLORS.purple },
    { label: "Protocol ops", value: "30%", sub: "Funds rollout, maintenance and collection support.", tone: COLORS.yellow },
    { label: "Staker fees", value: "10% fee share", sub: "10% of each trade fee is routed to stakers.", tone: COLORS.green },
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

export default function HomePage({ setPage, pool, isLive, poolError }) {
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
    <div style={{ width: "calc(100vw - 24px)", margin: "0 auto", padding: "118px 12px 64px" }}>
      <HeroGallery pool={pool} />

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
