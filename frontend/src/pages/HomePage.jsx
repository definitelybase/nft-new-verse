import React from "react";
import { MetalButton } from "../MetalButton";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { COLLECTION_SUPPLY, FEATURED_COLLECTION_IDS } from "../utils/generatedCollection";
import { revealStyle } from "../utils/helpers";
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
    { label: "Mint split", value: "60% / 10% / 30%", sub: "reserve / treasury / creator", tone: COLORS.accent },
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
  const splitCards = [
    { label: "Pool reserve", value: "60%", sub: "Every mint seeds floor liquidity.", tone: COLORS.accent },
    { label: "Treasury lane", value: "10%", sub: "Buyback and stale-inventory cleanup.", tone: COLORS.purple },
    { label: "Creator / team", value: "30%", sub: "Funds rollout, maintenance, and operating support.", tone: COLORS.yellow },
    { label: "Trade fee", value: "2.5%", sub: "Each trade routes fee into stakers, reserve, treasury, and protocol fees.", tone: COLORS.green },
  ];

  const gateCards = [
    {
      title: "Sell to pool",
      tone: COLORS.accent,
      eyebrow: "Floor exit lane",
      chips: ["launch > 6h", "not Expansion", "coverage ≥ 100%"],
    },
    {
      title: "Release inventory",
      tone: COLORS.purple,
      eyebrow: "Protocol listing gate",
      chips: ["Stabilization", "purchase ≥ 15 bps", "listings ≤ 1200 bps", "floor ≥ 120%"],
    },
    {
      title: "Treasury buyback",
      tone: COLORS.yellow,
      eyebrow: "Weak-demand cleanup",
      chips: ["weak / stale", "coverage ≥ 200%", "treasury 10%", "pool cap 5%"],
    },
    {
      title: "Trade fee split",
      tone: COLORS.green,
      eyebrow: "Fee machine",
      chips: ["10% stakers", "25% reserve", "25% treasury", "40% protocol"],
    },
  ];

  const signalCards = [
    {
      title: "Purchase rate",
      tone: COLORS.accent,
      formula: "sales / 24h",
      weak: "< 10",
      mid: "15+",
      strong: "35+",
    },
    {
      title: "Listing pressure",
      tone: COLORS.purple,
      formula: "listings / supply",
      weak: "> 1500",
      mid: "≤ 1200",
      strong: "≤ 800",
    },
    {
      title: "Floor ratio",
      tone: "#2AABCF",
      formula: "market / protocol",
      weak: "≤ 100%",
      mid: "120%",
      strong: "120%+",
    },
  ];

  const lifecycleCards = [
    ["Mint", "art + payment"],
    ["Reserve", "60% seeded"],
    ["Market", "premium discovery"],
    ["Signals", "sales / listings / floor"],
    ["Buyback", "weak-demand cleanup"],
    ["Vault", "relist or burn"],
  ];

  const comparisonColumns = [
    {
      kind: "standard",
      label: "Standard NFT mint",
      tone: "#E8853A",
      summary: "Primary sale ends here.",
      rails: [
        ["Mint", "user pays once"],
        ["Creator wallet", "value exits early"],
        ["Secondary market", "everything starts later"],
      ],
      outcomes: [
        "No reserve",
        "No buyback",
        "No protocol inventory",
        "No fee flow",
      ],
    },
    {
      kind: "protocol",
      label: "OnChainPixel mint",
      tone: "#7C56D8",
      summary: "The protocol starts on mint.",
      rails: [
        ["Mint", "user pays once"],
        ["Split", "60 / 10 / 30"],
        ["Protocol live", "market + reserve active"],
      ],
      outcomes: [
        "Floor lane",
        "Buyback",
        "Native market",
        "Fee flow",
      ],
    },
  ];

  function renderComparisonVisual(column) {
    if (column.kind === "standard") {
      return (
        <div
          style={{
            position: "relative",
            minHeight: 220,
            borderRadius: 20,
            border: `1px solid ${column.tone}33`,
            background: `linear-gradient(180deg, ${column.tone}14 0%, rgba(255,255,255,0.03) 72%)`,
            overflow: "hidden",
            padding: 16,
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -18,
              top: -18,
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: `${column.tone}16`,
              filter: "blur(10px)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ padding: "7px 12px", borderRadius: 999, background: `${column.tone}12`, color: column.tone, border: `1px solid ${column.tone}33`, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              Primary sale only
            </div>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              {"mint -> wallet -> market"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 12, alignItems: "center" }}>
            {column.rails.map(([title, sub], index) => (
              <React.Fragment key={title}>
                <div style={{ padding: "16px 10px", borderRadius: 18, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.06)", minHeight: 102, display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "center" }}>
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 15, fontWeight: 600 }}>{title}</div>
                  <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, lineHeight: 1.5, textTransform: "uppercase", letterSpacing: 0.6 }}>{sub}</div>
                </div>
                {index < 2 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 38, height: 2, background: `linear-gradient(90deg, ${column.tone}, ${column.tone}00)`, borderRadius: 999, opacity: 0.7 }} />
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: "12px", borderRadius: 16, border: `1px dashed ${column.tone}55`, background: `${column.tone}0D` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {column.outcomes.map((row) => (
                <div key={row} style={{ padding: "12px 10px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.05)", color: column.tone, fontFamily: fontDisplay, fontSize: 12, fontWeight: 600, lineHeight: 1.3, textAlign: "center", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {row}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          position: "relative",
          minHeight: 220,
          borderRadius: 20,
          border: `1px solid ${column.tone}33`,
          background: `linear-gradient(180deg, ${column.tone}14 0%, rgba(255,255,255,0.03) 72%)`,
          overflow: "hidden",
          padding: 16,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -22,
            bottom: -26,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: `${column.tone}14`,
            filter: "blur(12px)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ padding: "7px 12px", borderRadius: 999, background: `${column.tone}12`, color: column.tone, border: `1px solid ${column.tone}33`, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
            Protocol machine starts
          </div>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
            {"mint -> split -> protocol live"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 12, alignItems: "stretch" }}>
          <div style={{ padding: 14, borderRadius: 16, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.06)" }}>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              Mint split on the same tx
            </div>
            <div style={{ marginTop: 12, display: "flex", height: 22, borderRadius: 999, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
              <div style={{ width: "60%", background: COLORS.accent }} />
              <div style={{ width: "10%", background: COLORS.purple }} />
              <div style={{ width: "30%", background: COLORS.yellow }} />
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {[
                ["60%", "reserve", COLORS.accent],
                ["10%", "treasury", COLORS.purple],
                ["30%", "creator", COLORS.yellow],
              ].map(([value, label, color]) => (
                <div key={label} style={{ padding: "12px 8px", borderRadius: 14, background: `${color}12`, border: `1px solid ${color}33`, textAlign: "center" }}>
                  <div style={{ color, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>{value}</div>
                  <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, lineHeight: 1.5, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 16, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
            {column.outcomes.map((label, index) => {
              const colors = [COLORS.accent, COLORS.purple, "#2AABCF", COLORS.green];
              const color = colors[index % colors.length];
              return (
                <div key={label} style={{ padding: "14px 10px", borderRadius: 14, background: `${color}12`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color, fontFamily: fontDisplay, fontSize: 14, fontWeight: 600, minHeight: 64 }}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginTop: 14, alignItems: "stretch" }}>
        <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 24, display: "flex", flexDirection: "column", minHeight: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ color: "#E8853A", fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Why this mint is different
            </div>
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
              Standard mint vs OnChainPixel
            </div>
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7, marginBottom: 12 }}>
            Same mint action. Completely different result.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, flex: 1 }}>
            {comparisonColumns.map((column) => (
              <div key={column.label} style={{ padding: 16, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                <div style={{ minHeight: 88 }}>
                  <div style={{ color: column.tone, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>
                    {column.label}
                  </div>
                  <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.6 }}>
                    {column.summary}
                  </div>
                </div>

                {renderComparisonVisual(column)}
              </div>
            ))}
          </div>
        </FrostCard>

        <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 24, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ color: "#1A9B67", fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
            Protocol machine
          </div>
          <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.6 }}>
            No discretionary magic. Just gates, thresholds, and fee routes.
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            {gateCards.map((card) => (
              <div key={card.title} style={{ padding: 14, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface, minHeight: 174, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ padding: "6px 10px", borderRadius: 999, alignSelf: "flex-start", background: `${card.tone}12`, color: card.tone, border: `1px solid ${card.tone}33`, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                  {card.eyebrow}
                </div>
                <div style={{ color: card.tone, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, lineHeight: 1.05 }}>
                  {card.title}
                </div>
                <div style={{ display: "grid", gap: 8, marginTop: "auto" }}>
                  {card.chips.map((chip) => (
                    <div key={chip} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.05)", color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, lineHeight: 1.4, textTransform: "uppercase", letterSpacing: 0.55 }}>
                      {chip}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
                Signal dashboard
              </div>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                thresholds that drive state
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {signalCards.map((card) => (
                <div key={card.title} style={{ padding: 14, borderRadius: 16, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ color: card.tone, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>{card.title}</div>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{card.formula}</div>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", height: 14, borderRadius: 999, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                    <div style={{ width: "33.333%", background: `${card.tone}22` }} />
                    <div style={{ width: "33.333%", background: `${card.tone}55` }} />
                    <div style={{ width: "33.333%", background: `${card.tone}` }} />
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                    <div style={{ padding: "8px 6px", borderRadius: 10, background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
                      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Weak</div>
                      <div style={{ marginTop: 2, color: COLORS.textMuted, fontFamily: fontDisplay, fontSize: 12 }}>{card.weak}</div>
                    </div>
                    <div style={{ padding: "8px 6px", borderRadius: 10, background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
                      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Release</div>
                      <div style={{ marginTop: 2, color: COLORS.textMuted, fontFamily: fontDisplay, fontSize: 12 }}>{card.mid}</div>
                    </div>
                    <div style={{ padding: "8px 6px", borderRadius: 10, background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
                      <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Expand</div>
                      <div style={{ marginTop: 2, color: COLORS.textMuted, fontFamily: fontDisplay, fontSize: 12 }}>{card.strong}</div>
                    </div>
                  </div>
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
                End-to-end pipeline
              </div>
              <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.6, maxWidth: 920 }}>
                What the system does after mint, in one visual pass.
              </div>
            </div>
            <Eyebrow tone="green">End-to-end</Eyebrow>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, alignItems: "stretch" }}>
            {lifecycleCards.map(([title, body], index) => {
              const tones = [COLORS.accent, COLORS.purple, COLORS.yellow, "#2AABCF", COLORS.green, "#D4497A"];
              const tone = tones[index % tones.length];
              return (
                <div key={title} style={{ padding: 14, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: COLORS.surface, minHeight: 120, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: `${tone}12`, border: `1px solid ${tone}33`, color: tone, fontFamily: fonts, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {index + 1}
                  </div>
                  <div style={{ marginTop: 8, color: tone, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600, lineHeight: 1.05 }}>
                    {title}
                  </div>
                  <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, lineHeight: 1.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {body}
                  </div>
                </div>
              );
            })}
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
