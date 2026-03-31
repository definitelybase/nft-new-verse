import React from "react";
import { MetalButton } from "../MetalButton";
import { useThemeMode } from "../ThemeModeContext";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { COLLECTION_SUPPLY, FEATURED_COLLECTION_IDS } from "../utils/generatedCollection";
import { driftStyle, fmtEth, revealStyle } from "../utils/helpers";
import { DataBadge, Eyebrow, FrostCard } from "../components/ui";

const MARQUEE_ROW_SIZE = 25;

function buildMarqueeRow(startIndex) {
  return Array.from({ length: MARQUEE_ROW_SIZE }, (_, index) => (startIndex + index) % COLLECTION_SUPPLY);
}

const ROW1_IDS = buildMarqueeRow(0);
const ROW2_IDS = buildMarqueeRow(25);
const ROW3_IDS = buildMarqueeRow(50);
const ROW4_IDS = buildMarqueeRow(75);

function NftMarquee({ ids, speed = 28, reverse = false }) {
  const items = [...ids, ...ids]; // дублируем для бесконечности
  const totalWidth = ids.length * (80 + 8); // size + gap
  const duration = totalWidth / speed;
  return (
    <div style={{ overflow: "hidden", width: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          width: "max-content",
          animation: `marquee${reverse ? "Rev" : ""} ${duration}s linear infinite`,
        }}
      >
        {items.map((id, i) => (
          <div
            key={i}
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,0.04)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              src={`/collection/images/${id}.svg`}
              alt={`NFT #${id}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated", display: "block" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroGallery({ pool }) {
  const heroStats = [
    { label: "Mint split", value: "60% / 10% / 30%", sub: "reserve / treasury / ops", tone: COLORS.accent },
    { label: "Market lane", value: "Native market", sub: "premium discovery stays outside the pool", tone: COLORS.purple },
    { label: "Trade fee", value: "2.5% fee", sub: "stakers / pool / treasury / protocol", tone: COLORS.green },
  ];

  return (
    <FrostCard
      className="site-reveal"
      style={{
        padding: 28,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        gap: 24,
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
          pointerEvents: "none",
        }}
      />

      {/* Верх: текст + стата */}
      <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div>
          <Eyebrow>Protocol overview</Eyebrow>
          <div
            style={{
              marginTop: 24,
              fontFamily: fontDisplay,
              fontSize: "clamp(40px, 7vw, 78px)",
              lineHeight: 0.94,
              fontWeight: 600,
              letterSpacing: -2.6,
            }}
          >
            {"Pixel art".split("").map((ch, i) => {
              const clrs = ["#B39DDB","#F48FB1","#FFCC80","#A5D6A7","#90CAF9","#CE93D8","#80DEEA","#FFAB91"];
              return <span key={i} style={{ color: ch === " " ? "transparent" : clrs[i % clrs.length] }}>{ch === " " ? "\u00A0" : ch}</span>;
            })}
            <span style={{ color: "#F48FB1" }}>.</span>
            <br />
            {"Liquidity engine".split("").map((ch, i) => {
              const clrs = ["#A5D6A7","#90CAF9","#FFCC80","#FFAB91","#F48FB1","#B39DDB","#80DEEA","#CE93D8"];
              return <span key={i} style={{ color: ch === " " ? "transparent" : clrs[i % clrs.length] }}>{ch === " " ? "\u00A0" : ch}</span>;
            })}
            <span style={{ color: "#90CAF9" }}>.</span>
          </div>
          <p
            style={{
              margin: "18px 0 0",
              maxWidth: 500,
              color: COLORS.textMuted,
              fontFamily: fonts,
              fontSize: 13,
              lineHeight: 1.75,
            }}
          >
            Fully on-chain pixel collection with a native market and a reserve-backed floor lane.
            Premium pricing stays in the market. The pool only handles the floor side when
            reserve coverage and market-state rules allow it.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 22 }}>
            {heroStats.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "14px 14px 12px",
                  borderRadius: 18,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,0.04)",
                  minHeight: 88,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{item.label}</div>
                <div style={{ marginTop: 8, color: item.tone, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, lineHeight: 1.05 }}>{item.value}</div>
                {item.sub && <div style={{ marginTop: 4, color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, letterSpacing: 0.5 }}>{item.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Правая часть: инфо */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "stretch" }}>
          {[
            { label: "Collection", value: `${COLLECTION_SUPPLY.toLocaleString()} genesis`, tone: "#7C56D8", desc: "Every piece is stored and rendered on-chain, without external image hosting." },
            { label: "Floor lane", value: "Reserve-gated", tone: "#1DB37A", desc: "The pool opens only after launch protection and only while reserve coverage and market-state rules stay inside range." },
            { label: "Buyback policy", value: "Selective", tone: "#E8853A", desc: "Treasury removes stale inventory only in weak demand and only with strong coverage. It is cleanup logic, not a support switch." },
            { label: "Staking", value: "Fee flow", tone: "#D4497A", desc: "Stakers receive 10% of protocol trade fees from real trading activity. No emissions and no fixed yield." },
            { label: "Pool pricing", value: "Rule-based", tone: "#2AABCF", desc: "The floor quote follows reserve, sell pressure, and EMA guardrails. It does not price rare traits." },
            { label: "On-chain art", value: "Chain-rendered", tone: "#C9A800", desc: "Pixel data is packed into Ethereum storage and rendered directly from the chain." },
          ].map((item) => (
            <div key={item.label} style={{ padding: "20px 22px", borderRadius: 20, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{item.label}</div>
              <div style={{ color: item.tone, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{item.value}</div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.7 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 ленты */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <NftMarquee ids={ROW1_IDS} speed={20} />
        <NftMarquee ids={ROW2_IDS} speed={15} reverse />
        <NftMarquee ids={ROW3_IDS} speed={18} />
        <NftMarquee ids={ROW4_IDS} speed={12} reverse />
      </div>
    </FrostCard>
  );
}

function LiquiditySystemOverview({ className = "", style }) {
  const themeMode = useThemeMode();
  const isLight = themeMode === "light";
  const chartGrid = isLight ? "rgba(42,51,68,0.18)" : "rgba(255,255,255,0.10)";
  const chartDivider = isLight ? "rgba(42,51,68,0.28)" : "rgba(255,255,255,0.16)";
  const chartText = isLight ? "#4A5266" : "#8A91A5";
  const chartFloor = isLight ? "#6B7592" : "#8A91A5";
  const chartBg = isLight ? "#eef0f6" : "#07070B";

  const splitCards = [
    { label: "Pool reserve", value: "60%", sub: "Every mint seeds floor liquidity.", tone: COLORS.accent },
    { label: "Treasury lane", value: "10%", sub: "Buyback and stale-inventory cleanup.", tone: COLORS.purple },
    { label: "Protocol ops", value: "30%", sub: "Funds rollout, maintenance, and operating support.", tone: COLORS.yellow },
    { label: "Trade fee", value: "2.5%", sub: "Each trade routes fee into stakers, reserve, treasury, and protocol fees.", tone: COLORS.green },
  ];

  const signalRows = [
    ["Purchase rate", "sales in 24h / circulating supply", "Expansion wants >= 35 bps. Release wants >= 15 bps. Weak demand counts it as weak below 10 bps."],
    ["Listing pressure", "active listings / circulating supply", "Expansion wants <= 800 bps. Release wants <= 1200 bps. Weak demand counts it as weak above 1500 bps."],
    ["Floor ratio", "market floor / protocol floor", "Expansion and release both want >= 120%. Weak demand counts it as weak at or below 100%."],
  ];

  const ruleCards = [
    ["Mint route", "Router mints the NFT, then routes 60% into reserve, 10% into treasury, and 30% into ops. The reserve is funded on day one instead of waiting for secondary demand."],
    ["Sell-to-pool gate", "Sell-to-pool only opens after the 6h launch-protection window, only outside Expansion, and only while coverage stays at or above 100%."],
    ["Release gate", "Protocol inventory only re-enters the market in Stabilization and only if purchase rate, listing pressure, and floor ratio all pass the release thresholds."],
    ["Weak-demand cleanup", "Buyback activates only when weak demand or stale / excess inventory appears, and only when coverage is at least 200%."],
    ["Fee routing", "Trade fee is 2.5%. Inside that fee: 10% goes to stakers, 25% back to reserve, 25% to treasury, and 40% to protocol fees."],
    ["Settlement truth", "Protocol inventory only improves sell pressure after a real marketplace sale. Moving an NFT into a listing does not count as cleanup by itself."],
  ];

  const lifecycleCards = [
    ["1. Mint seeds the machine", "The first mint does not wait for secondary demand. It seeds reserve, treasury, and ops immediately."],
    ["2. Holders choose the route", "After mint, holders can hold, list in the native market, stake for fee flow, or sell into the pool if the sell lane is open."],
    ["3. Pool only quotes the floor", "The pool does not value rare traits. It only quotes the collection floor and leaves premium discovery to the marketplace."],
    ["4. Marketplace feeds the state machine", "Recent sales, active listings, and the market floor feed Weak Demand, Stabilization, and Expansion inside the pool."],
    ["5. Treasury cleans weak markets", "If inventory gets stale or weak demand persists, treasury buyback can remove part of that inventory under strict coverage limits."],
    ["6. Vault and relist stay gated", "Inventory can move into vault, burn, or relist only when the protocol gates say the market can actually absorb it."],
  ];

  const zones = [
    { label: "Weak demand", dot: "#D6B861" },
    { label: "Stabilization", dot: "#AE8BFF" },
    { label: "Expansion", dot: "#76AEEB" },
  ];

  return (
    <FrostCard className={className} style={{ padding: 20, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ color: "#7C56D8", fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: -0.9 }}>
            How liquidity works
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 6, lineHeight: 1.7, maxWidth: 980 }}>
            This is the full on-site protocol summary. Mints seed the reserve, the pool quotes only the floor lane, the native marketplace supplies the live demand signals, and treasury only cleans weak markets when guarded thresholds say it is safe. Rare-piece pricing stays in the marketplace, not inside the pool.
          </div>
        </div>
        <Eyebrow tone="purple">Protocol flow</Eyebrow>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "stretch" }}>
        {splitCards.map((item) => (
          <FrostCard key={item.label} style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 24, minHeight: 136, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 14, marginTop: 14, alignItems: "stretch" }}>
        <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 24, display: "flex", flexDirection: "column", minHeight: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ color: "#E8853A", fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Market-state curve
            </div>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              Demand vs protocol behavior
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
            {zones.map((zone) => (
              <div key={zone.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: zone.dot, flexShrink: 0 }} />
                <span style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                  {zone.label}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: `1px solid ${chartDivider}`,
              background: chartBg,
              flex: 1,
              display: "flex",
              minHeight: 300,
            }}
          >
            {/*
              X-axis = demand pressure (left = weak, right = strong)
              Y-axis = price (bottom = protocol floor, top = market premium)

              FLOOR CURVE: linear decay 60%→15% of mint price as sells accumulate
                - starts high-left (fresh pool, 60% bid), drops to 15% floor over ~3000 sells
                - EMA guard smooths it — no instant collapse
              MARKET PRICE: tracks demand
                - weak demand: market ≤ floor (floorRatio ≤ 100%) → buyback eligible if coverage ≥ 200%
                - stabilization: market 100–120% of floor → inventory release, sell-to-pool open
                - expansion: market ≥ 120% of floor → sell-to-pool CLOSED, pool protects reserve
            */}
            <svg viewBox="0 0 920 420" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "100%" }}>

              {/* zone backgrounds */}
              <rect x="46" y="28" width="260" height="330" fill={isLight ? "rgba(214,184,97,0.08)" : "rgba(214,184,97,0.05)"} />
              <rect x="306" y="28" width="307" height="330" fill={isLight ? "rgba(174,139,255,0.07)" : "rgba(174,139,255,0.05)"} />
              <rect x="613" y="28" width="277" height="330" fill={isLight ? "rgba(118,174,235,0.07)" : "rgba(118,174,235,0.05)"} />

              {/* horizontal grid lines */}
              {[80, 150, 220, 290].map((y) => (
                <line key={y} x1="46" y1={y} x2="890" y2={y} stroke={chartGrid} strokeWidth="1" />
              ))}

              {/* zone dividers */}
              <line x1="306" y1="28" x2="306" y2="358" stroke={chartDivider} strokeDasharray="3 5" strokeWidth="1" />
              <line x1="613" y1="28" x2="613" y2="358" stroke={chartDivider} strokeDasharray="3 5" strokeWidth="1" />

              {/* zone labels */}
              <text x="176" y="44" fill="#D6B861" fillOpacity={isLight ? "0.75" : "0.5"} fontSize="9" fontFamily="IBM Plex Mono, monospace" letterSpacing="1.5" textAnchor="middle">WEAK DEMAND</text>
              <text x="459" y="44" fill="#AE8BFF" fillOpacity={isLight ? "0.75" : "0.5"} fontSize="9" fontFamily="IBM Plex Mono, monospace" letterSpacing="1.5" textAnchor="middle">STABILIZATION</text>
              <text x="751" y="44" fill="#76AEEB" fillOpacity={isLight ? "0.75" : "0.5"} fontSize="9" fontFamily="IBM Plex Mono, monospace" letterSpacing="1.5" textAnchor="middle">EXPANSION</text>

              {/* Y-axis labels */}
              <text x="50" y="80" fill={chartText} fontSize="9" fontFamily="IBM Plex Mono, monospace">60% mint</text>
              <text x="50" y="290" fill={chartText} fontSize="9" fontFamily="IBM Plex Mono, monospace">15% mint</text>
              <text x="50" y="360" fill={chartText} fontSize="9" fontFamily="IBM Plex Mono, monospace">FLOOR</text>

              {/* ── PROTOCOL FLOOR (curve bid decay: 60%→15% of mint) ── */}
              <path
                d="M68 78 C120 82, 200 110, 306 200 C380 260, 460 285, 613 292 C720 296, 800 294, 862 292"
                fill="none" stroke={chartFloor} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 5"
              />
              <text x="868" y="296" fill={chartFloor} fontSize="8" fontFamily="IBM Plex Mono, monospace">bid floor</text>

              {/* spread fill between floor and market — weak demand */}
              <path
                d="M68 310 C120 295, 200 240, 306 200 C200 110, 120 82, 68 78 Z"
                fill="rgba(214,184,97,0.06)"
              />

              {/* ── MARKET PRICE ── */}
              <path d="M68 310 C120 295, 200 240, 306 200" fill="none" stroke="#D6B861" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M306 200 C380 175, 500 148, 613 128" fill="none" stroke="#AE8BFF" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M613 128 C700 112, 790 100, 862 96"  fill="none" stroke="#76AEEB" strokeWidth="2.5" strokeLinecap="round" />

              <defs>
                <marker id="arrowGold" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#D6B861" />
                </marker>
              </defs>

              {/* buyback arrow — weak demand, coverage ≥200% */}
              <line x1="150" y1="322" x2="150" y2="302" stroke="#D6B861" strokeWidth="1.5" markerEnd="url(#arrowGold)" opacity={isLight ? "0.9" : "0.75"} />
              <text x="108" y="338" fill="#D6B861" fillOpacity={isLight ? "0.9" : "0.7"} fontSize="9" fontFamily="IBM Plex Mono, monospace">buyback</text>
              <text x="105" y="349" fill="#D6B861" fillOpacity={isLight ? "0.65" : "0.4"} fontSize="8" fontFamily="IBM Plex Mono, monospace">coverage ≥200%</text>

              {/* sell-to-pool: open */}
              <rect x="316" y="212" width="114" height="20" rx="4" fill={isLight ? "rgba(174,139,255,0.14)" : "rgba(174,139,255,0.1)"} stroke="#AE8BFF" strokeOpacity={isLight ? "0.5" : "0.2"} strokeWidth="1" />
              <text x="373" y="226" fill="#AE8BFF" fillOpacity={isLight ? "0.95" : "0.85"} fontSize="9" fontFamily="IBM Plex Mono, monospace" textAnchor="middle">sell-to-pool: open</text>

              {/* sell-to-pool: closed */}
              <rect x="622" y="97" width="118" height="20" rx="4" fill={isLight ? "rgba(224,96,96,0.12)" : "rgba(224,96,96,0.1)"} stroke={isLight ? "rgba(224,96,96,0.45)" : "rgba(224,96,96,0.25)"} strokeWidth="1" />
              <text x="681" y="111" fill="rgba(224,96,96,0.95)" fontSize="9" fontFamily="IBM Plex Mono, monospace" textAnchor="middle">sell-to-pool: closed</text>

              {/* transition dots */}
              <circle cx="306" cy="200" r="5" fill="#AE8BFF" />
              <circle cx="306" cy="200" r="9" fill="none" stroke="#AE8BFF" strokeWidth="1" opacity={isLight ? "0.5" : "0.3"} />
              <text x="262" y="194" fill="#AE8BFF" fillOpacity={isLight ? "0.85" : "0.65"} fontSize="8" fontFamily="IBM Plex Mono, monospace">ratio=100%</text>

              <circle cx="613" cy="128" r="5" fill="#76AEEB" />
              <circle cx="613" cy="128" r="9" fill="none" stroke="#76AEEB" strokeWidth="1" opacity={isLight ? "0.5" : "0.3"} />
              <text x="569" y="122" fill="#76AEEB" fillOpacity={isLight ? "0.85" : "0.65"} fontSize="8" fontFamily="IBM Plex Mono, monospace">ratio=120%</text>

              {/* X axis label */}
              <text x="460" y="410" fill={chartText} fontSize="9" fontFamily="IBM Plex Mono, monospace" textAnchor="middle" letterSpacing="1">← demand pressure (purchaseRate / listingPressure) →</text>

            </svg>
          </div>
        </FrostCard>

        <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ color: "#1A9B67", fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
            Protocol rules and gates
          </div>
          <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
            The pool does not make discretionary decisions. It reads marketplace signals and follows explicit gates.
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {ruleCards.map(([title, body]) => (
              <div key={title} style={{ padding: 14, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface, minHeight: 124 }}>
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
                  {title}
                </div>
                <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                  {body}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
              Signal inputs
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {signalRows.map(([title, formula, note]) => (
                <div key={title} style={{ display: "grid", gridTemplateColumns: "150px 180px 1fr", gap: 10, alignItems: "start" }}>
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 13, fontWeight: 600 }}>{title}</div>
                  <div style={{ color: "#7C56D8", fontFamily: fonts, fontSize: 10, letterSpacing: 0.4, lineHeight: 1.6, textTransform: "uppercase" }}>{formula}</div>
                  <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>{note}</div>
                </div>
              ))}
            </div>
          </div>
        </FrostCard>
      </div>

      <div style={{ marginTop: 14 }}>
        <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#2AABCF", fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
                Full lifecycle on one page
              </div>
              <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7, maxWidth: 920 }}>
                This is the shortest honest explanation of the whole machine: mint funds reserve, holders choose between market / stake / pool, marketplace signals drive the state machine, and treasury only cleans inventory when demand weakens and coverage is strong enough.
              </div>
            </div>
            <Eyebrow tone="green">End-to-end</Eyebrow>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {lifecycleCards.map(([title, body]) => (
              <div key={title} style={{ padding: 14, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface, minHeight: 118 }}>
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 15, fontWeight: 600 }}>
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
  const [toast, setToast] = React.useState(false);
  const showSoon = React.useCallback(() => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }, []);
  const features = [
    {
      title: "SSTORE2-backed art",
      desc: "Images live as packed pixel data on-chain, not on an external image server.",
      tone: "accent",
    },
    {
      title: "Floor-liquidity thesis",
      desc: "The protocol quotes only the floor lane while the market decides which pieces deserve premium prices.",
      tone: "green",
    },
    {
      title: "Gallery-style market",
      desc: "The market is meant to read like a collection view, not an exchange terminal.",
      tone: "purple",
    },
  ];

  return (
    <div style={{ width: "calc(100vw - 24px)", margin: "0 auto", padding: "118px 12px 64px" }}>
      <HeroGallery pool={pool} />

      <div className="site-reveal-soft" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "center", ...revealStyle(320) }}>
        <MetalButton onClick={showSoon} tone="ghost" style={{ opacity: 0.5, cursor: "default" }}>
          Mint route
        </MetalButton>
        <MetalButton onClick={showSoon} tone="ghost" style={{ opacity: 0.5, cursor: "default" }}>
          Market route
        </MetalButton>
        <MetalButton onClick={showSoon} tone="ghost" style={{ opacity: 0.5, cursor: "default" }}>
          Stake route
        </MetalButton>
      </div>
      {toast && (
        <div style={{
          position: "fixed",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--ocp-surface-strong)",
          border: "1px solid var(--ocp-border)",
          borderRadius: 12,
          padding: "10px 20px",
          fontFamily: `'IBM Plex Mono', monospace`,
          fontSize: 13,
          color: "var(--ocp-text-muted)",
          zIndex: 200,
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          Preview only
        </div>
      )}

      <FrostCard className="site-reveal" style={{ padding: 18, marginTop: 22, ...revealStyle(620) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#D4497A", fontFamily: fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: -0.8 }}>
              Protocol core
            </div>
            <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
              Three short rules that explain the protocol before the deeper liquidity diagram.
            </div>
          </div>
          <Eyebrow tone="purple">Core notes</Eyebrow>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 14, alignItems: "stretch" }}>
          {features.map((feature, index) => (
            <FrostCard key={feature.title} className="site-reveal" style={{ padding: 16, background: COLORS.surfaceStrong, minHeight: 144, display: "flex", flexDirection: "column", justifyContent: "space-between", ...revealStyle(680 + index * 70) }}>
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
