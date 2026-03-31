import React from "react";
import { MetalButton } from "../MetalButton";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { COLLECTION_SUPPLY, FEATURED_COLLECTION_IDS } from "../utils/generatedCollection";
import { fmtEth, revealStyle } from "../utils/helpers";
import { DataBadge, Eyebrow, FrostCard } from "../components/ui";

const MARQUEE_ROW_SIZE = 25;

function buildMarqueeRow(startIndex) {
  return Array.from({ length: MARQUEE_ROW_SIZE }, (_, index) => (startIndex + index) % COLLECTION_SUPPLY);
}

const ROW1_IDS = buildMarqueeRow(0);
const ROW2_IDS = buildMarqueeRow(25);
const ROW3_IDS = buildMarqueeRow(50);
const ROW4_IDS = buildMarqueeRow(75);

const BACKDROP_PIXEL_PATTERNS = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]],
];

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildBackdropPixels(count, seed = 1337) {
  const random = createSeededRandom(seed);
  const palette = [
    "rgba(124, 86, 216, 0.18)",
    "rgba(42, 171, 207, 0.16)",
    "rgba(26, 155, 103, 0.16)",
    "rgba(232, 133, 58, 0.16)",
    "rgba(212, 73, 122, 0.15)",
    "rgba(183, 138, 31, 0.15)",
  ];

  return Array.from({ length: count }, (_, index) => {
    const pattern = BACKDROP_PIXEL_PATTERNS[Math.floor(random() * BACKDROP_PIXEL_PATTERNS.length)];
    return {
      id: index,
      left: `${6 + random() * 88}%`,
      top: `${3 + random() * 94}%`,
      size: 8 + Math.floor(random() * 8),
      opacity: 0.42 + random() * 0.34,
      color: palette[Math.floor(random() * palette.length)],
      pattern,
    };
  });
}

const HOME_BACKDROP_PIXELS = buildBackdropPixels(56, 20260331);

/* ── Marquee keyframes (injected once) ── */
function MarqueeStyles() {
  return (
    <style>{`
      @keyframes marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      @keyframes marqueeRev {
        0% { transform: translateX(-50%); }
        100% { transform: translateX(0); }
      }
    `}</style>
  );
}

function HomePixelBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 12% 18%, rgba(124, 86, 216, 0.08), transparent 24%), radial-gradient(circle at 86% 12%, rgba(42, 171, 207, 0.08), transparent 22%), radial-gradient(circle at 14% 78%, rgba(232, 133, 58, 0.06), transparent 22%), radial-gradient(circle at 82% 74%, rgba(26, 155, 103, 0.06), transparent 24%)",
        }}
      />
      {HOME_BACKDROP_PIXELS.map((cluster) => (
        <div
          key={cluster.id}
          style={{
            position: "absolute",
            left: cluster.left,
            top: cluster.top,
            width: cluster.size * 3,
            height: cluster.size * 3,
            opacity: cluster.opacity,
          }}
        >
          {cluster.pattern.map(([x, y], pixelIndex) => (
            <div
              key={pixelIndex}
              style={{
                position: "absolute",
                left: x * cluster.size,
                top: y * cluster.size,
                width: cluster.size,
                height: cluster.size,
                borderRadius: 2,
                background: cluster.color,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function NftMarquee({ ids, speed = 28, reverse = false }) {
  const items = [...ids, ...ids];
  const totalWidth = ids.length * (80 + 8);
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

/* ── Animated liquidity loading bar ── */
function LiquidityBar({ pool }) {
  const minted = Math.max(Number(pool.totalMinted || 0), 0);
  const reserveEth = Number(pool.ethBalance || 0);
  const floorEth = Number(pool.floor || 0);
  const coveragePct = pool.liqRatio > 0 ? Math.round(pool.liqRatio * 100) : 0;
  const liveGrowthPct = minted > 0 ? Math.min((minted / COLLECTION_SUPPLY) * 100, 100) : 0;
  const growthPct = liveGrowthPct > 0 ? Math.max(liveGrowthPct, 4) : 12;
  const reserveMilestones = [1, 10, 100, COLLECTION_SUPPLY];
  const growthSteps = [
    ["User mints", "60% of that mint goes straight into reserve.", COLORS.accent],
    ["Split executes", "10% goes to treasury and 30% to creator / team.", COLORS.purple],
    ["Pool grows", "More mints deepen reserve and support the floor lane.", COLORS.green],
  ];
  return (
    <FrostCard style={{ padding: 22, background: COLORS.surfaceStrong, borderRadius: 24, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: -0.6 }}>
            How the reserve grows
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, marginTop: 2 }}>
            Minting does not just sell an NFT. It seeds reserve on the same transaction and grows the pool over time.
          </div>
        </div>
        <div style={{
          padding: "5px 12px", borderRadius: 999,
          background: COLORS.greenSoft, color: COLORS.green,
          fontFamily: fonts, fontSize: 11, fontWeight: 700,
        }}>
          {reserveEth > 0 ? `Live reserve ${reserveEth.toFixed(3)} ETH` : "Launch model"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {growthSteps.map(([title, body, tone], index) => (
          <div
            key={title}
            style={{
              padding: 16,
              borderRadius: 20,
              border: `1px solid ${COLORS.border}`,
              background: index === 1 ? "rgba(174,139,255,0.08)" : "rgba(255,255,255,0.05)",
              position: "relative",
              overflow: "hidden",
              minHeight: 108,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>{title}</div>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: `${tone}16`,
                  border: `1px solid ${tone}28`,
                  color: tone,
                  fontFamily: fontDisplay,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {index + 1}
              </div>
            </div>
            <div style={{ marginTop: 10, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.75, maxWidth: 250 }}>
              {body}
            </div>
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, height: 6, borderRadius: 999, background: `${tone}24` }} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: 16, borderRadius: 20, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 15, fontWeight: 600 }}>Minted supply accumulates inside reserve</div>
            <div style={{ marginTop: 3, color: COLORS.textMuted, fontFamily: fonts, fontSize: 10 }}>
              The reserve does not appear later. It compounds from mint one to the full collection.
            </div>
          </div>
          <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {minted > 0 ? `${minted.toLocaleString()} / ${COLLECTION_SUPPLY.toLocaleString()} minted` : `${COLLECTION_SUPPLY.toLocaleString()} supply target`}
          </div>
        </div>

        <div style={{ position: "relative", height: 18, borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${growthPct}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, #7CB7F6, #AE8BFF, #6EE7B7)",
              transition: "width 1.5s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 2.5s ease-in-out infinite",
              }}
            />
          </div>
          {reserveMilestones.map((milestone, index) => {
            const left = `${(index / (reserveMilestones.length - 1)) * 100}%`;
            const isActive = milestone <= Math.max(minted, 1);
            return (
              <div
                key={milestone}
                style={{
                  position: "absolute",
                  left,
                  top: "50%",
                  transform: index === reserveMilestones.length - 1 ? "translate(-100%, -50%)" : "translate(-50%, -50%)",
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: isActive ? COLORS.text : "rgba(255,255,255,0.18)",
                  boxShadow: "0 0 0 3px rgba(255,255,255,0.12)",
                }}
              />
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
          {reserveMilestones.map((milestone) => (
            <div key={milestone} style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, lineHeight: 1.5 }}>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 12, fontWeight: 600 }}>
                {milestone.toLocaleString()} mint{milestone > 1 ? "s" : ""}
              </div>
              <div style={{ marginTop: 2 }}>
                {milestone === 1 && "Reserve starts"}
                {milestone === 10 && "Early pool base"}
                {milestone === 100 && "Deeper floor support"}
                {milestone === COLLECTION_SUPPLY && "Full collection reserve"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
        {[
          { label: "Pool reserve", value: fmtEth(reserveEth), color: COLORS.accent },
          { label: "Minted", value: minted.toLocaleString(), color: COLORS.purple },
          { label: "Floor bid", value: fmtEth(floorEth), color: "#F4CF66" },
          { label: "Coverage", value: coveragePct > 0 ? `${coveragePct}%` : "Forming", color: COLORS.green },
        ].map((b) => (
          <div
            key={b.label}
            style={{
              padding: 14,
              borderRadius: 18,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>{b.label}</div>
            <div style={{ marginTop: 8, color: b.color, fontFamily: fontDisplay, fontSize: 17, fontWeight: 600, lineHeight: 1.1 }}>
              {b.value}
            </div>
          </div>
        ))}
      </div>
    </FrostCard>
  );
}

function HeroGallery({ pool }) {
  const heroStats = [
    { label: "Collection", value: `${COLLECTION_SUPPLY.toLocaleString()} supply`, sub: "mint price TBA", tone: COLORS.purple },
    { label: "Mint split", value: "60% / 10% / 30%", sub: "reserve / treasury / creator", tone: COLORS.accent },
    { label: "Trade fee", value: "2.5% fee", sub: "real market activity, not emissions", tone: COLORS.green },
  ];
  const mintSplitValue = [
    ["60%", COLORS.accent],
    [" / ", COLORS.textDim],
    ["10%", COLORS.purple],
    [" / ", COLORS.textDim],
    ["30%", COLORS.yellow],
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
            A fully on-chain pixel collection where minting does more than sell an NFT.
            Every mint routes 60% into reserve, 10% into treasury, and 30% into creator / team,
            so the protocol starts with native market structure instead of waiting for secondary demand.
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
                <div style={{ marginTop: 8, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600, lineHeight: 1.05 }}>
                  {item.label === "Mint split"
                    ? mintSplitValue.map(([part, color], index) => (
                        <span key={`${part}-${index}`} style={{ color }}>
                          {part}
                        </span>
                      ))
                    : <span style={{ color: item.tone }}>{item.value}</span>}
                </div>
                {item.sub && <div style={{ marginTop: 4, color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, letterSpacing: 0.5 }}>{item.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "stretch" }}>
          {[
            { label: "On-chain art", value: "Chain-rendered", tone: "#C9A800", desc: "Every piece is stored and rendered on-chain. No external image hosting." },
            { label: "Floor lane", value: "Reserve-backed", tone: "#1DB37A", desc: "The pool only quotes the collection floor, and only while reserve coverage and gates stay healthy." },
            { label: "Mint design", value: "Machine starts on mint", tone: "#7C56D8", desc: "A standard mint ends at the primary sale. This one starts reserve, treasury, and market logic on the same transaction." },
            { label: "Treasury", value: "Cleanup only", tone: "#E8853A", desc: "Treasury removes stale inventory in weak demand. It is cleanup logic, not manual price support." },
            { label: "Market", value: "Premium stays native", tone: "#2AABCF", desc: "Rare pieces and premium pricing stay in the marketplace, not inside the pool." },
            { label: "Staking", value: "Real fee flow", tone: "#D4497A", desc: "Stakers receive 10% of protocol trade fees from actual trading activity. No emissions and no fixed yield." },
          ].map((item) => (
            <div key={item.label} style={{ padding: "20px 22px", borderRadius: 20, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{item.label}</div>
              <div style={{ color: item.tone, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>{item.value}</div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.7 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 animated NFT marquee rows */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <NftMarquee ids={ROW1_IDS} speed={20} />
        <NftMarquee ids={ROW2_IDS} speed={15} reverse />
        <NftMarquee ids={ROW3_IDS} speed={18} />
        <NftMarquee ids={ROW4_IDS} speed={12} reverse />
      </div>

      {/* Liquidity loading bar */}
      <LiquidityBar pool={pool} />
    </FrostCard>
  );
}

const INFO_PANEL_PIXELS = {
  problem: buildBackdropPixels(20, 701),
  split: buildBackdropPixels(18, 702),
  afterMint: buildBackdropPixels(18, 703),
  states: buildBackdropPixels(18, 704),
  curve: buildBackdropPixels(16, 705),
  staking: buildBackdropPixels(16, 706),
  market: buildBackdropPixels(16, 707),
  faq: buildBackdropPixels(22, 708),
};

function PanelConfetti({ pixels }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 0.9,
      }}
    >
      {pixels.map((cluster) => (
        <div
          key={cluster.id}
          style={{
            position: "absolute",
            left: cluster.left,
            top: cluster.top,
            width: cluster.size * 3,
            height: cluster.size * 3,
            opacity: cluster.opacity * 0.55,
          }}
        >
          {cluster.pattern.map(([x, y], pixelIndex) => (
            <div
              key={pixelIndex}
              style={{
                position: "absolute",
                left: x * cluster.size,
                top: y * cluster.size,
                width: cluster.size,
                height: cluster.size,
                borderRadius: 2,
                background: cluster.color,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PanelBadge({ tone, glyph }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tone,
        border: `1px solid ${tone}30`,
        background: `${tone}10`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 12px 30px ${tone}10`,
        fontFamily: fontDisplay,
        fontSize: 22,
        fontWeight: 600,
      }}
    >
      {glyph}
    </div>
  );
}

function InsightPanel({ title, tone, glyph, pixels, children, style }) {
  return (
    <FrostCard
      style={{
        position: "relative",
        padding: 18,
        borderRadius: 30,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.07) 100%)",
        ...style,
      }}
    >
      <PanelConfetti pixels={pixels} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <PanelBadge tone={tone} glyph={glyph} />
          <div style={{ color: tone, fontFamily: fontDisplay, fontSize: 21, fontWeight: 600, letterSpacing: -0.6 }}>
            {title}
          </div>
        </div>
        {children}
      </div>
    </FrostCard>
  );
}

function LiquiditySystemOverview({ className = "", style }) {
  const problemColumns = [
    {
      label: "Standard NFT",
      tone: "#D96A5C",
      rows: [
        "Art on external server",
        "No floor liquidity",
        "Marketplace is third-party",
        "No treasury logic",
      ],
    },
    {
      label: "Dwellers",
      tone: COLORS.green,
      rows: [
        "Art fully on-chain",
        "Reserve-backed floor bid",
        "Native marketplace",
        "Treasury cleanup path",
      ],
    },
  ];

  const mintSplitRows = [
    ["Pool reserve", "Seeds floor liquidity from first mint", COLORS.accent],
    ["Treasury", "Buyback and stale-inventory cleanup fund", COLORS.purple],
    ["Creator / team", "Rollout, maintenance, operating support", COLORS.yellow],
  ];

  const afterMintCards = [
    ["List on marketplace", "Sell peer-to-peer at any price. Premium and rarity pricing stay here.", "rgba(110,231,183,0.18)"],
    ["Sell into pool", "Exit at the floor bid when pool buying is enabled. Reserve-gated, not always open.", "rgba(244,207,102,0.18)"],
    ["Protocol resale", "Pool inventory can re-enter the marketplace. Sell pressure clears only after actual sale.", "rgba(174,139,255,0.16)"],
  ];

  const marketStateRows = [
    ["Expansion", "Sell-to-pool closed", "Strong demand. Market floor sits above protocol floor, so the pool stays conservative."],
    ["Stabilization", "Sell-to-pool open", "Normal operation. Market is active and protocol inventory can be released in a controlled way."],
    ["Weak demand", "Buyback eligible", "Purchase rate weakens, listing pressure rises, and treasury cleanup may activate."],
  ];

  const curveBars = [60, 52, 46, 40, 35, 31, 27, 23, 19, 15];
  const stakeWeights = [
    ["1x", "No lock"],
    ["1.25x", "7 days"],
    ["1.5x", "30 days"],
    ["2x", "90 days"],
  ];
  const marketTiles = [
    ["Listings", "User and protocol inventory"],
    ["Token offers", "Bid on specific pieces"],
    ["Collection offers", "Bid on any piece in collection"],
    ["Activity log", "Full on-chain trade history"],
  ];
  const faqRows = [
    [
      "Can I always sell to the pool?",
      "No. Sell-to-pool is reserve-gated and closes during expansion. The pool is a floor exit, not a permanent bid.",
    ],
    [
      "Is this a guaranteed buyback?",
      "No. Treasury buyback is a targeted cleanup action for stale inventory in weak demand, not a price guarantee.",
    ],
    [
      "What if demand drops?",
      "The protocol can enter weak-demand state. Pool quotes become more conservative, treasury cleanup may activate, and the floor decays under its rules instead of pretending demand is still strong.",
    ],
    [
      "Where does staking yield come from?",
      "From real trade fees only. No emissions token, no inflation. If nobody trades, stakers earn nothing.",
    ],
    [
      "Can the owner drain the reserve?",
      "There is no simple owner withdraw on pool reserve. Admin powers still exist, and launch ownership is intended to move to a Safe multisig.",
    ],
  ];

  const marketStateTones = [COLORS.accent, COLORS.purple, COLORS.yellow];

  return (
    <div className={className} style={{ display: "grid", gap: 14, ...style }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 14, alignItems: "stretch" }}>
        <InsightPanel title="The problem we solve" tone={COLORS.purple} glyph="◎" pixels={INFO_PANEL_PIXELS.problem}>
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, lineHeight: 1.25 }}>
            Most NFTs have no native exit lane at all.
          </div>
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "0.92fr 1.08fr",
              gap: 14,
              padding: 14,
              borderRadius: 24,
              background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {problemColumns.map((column, columnIndex) => (
              <div
                key={column.label}
                style={{
                  padding: columnIndex === 0 ? "14px 14px 12px" : "16px 16px 14px",
                  borderRadius: 20,
                  background: columnIndex === 0 ? "rgba(255,255,255,0.05)" : `${column.tone}10`,
                  border: columnIndex === 0 ? `1px solid ${COLORS.border}` : `1px solid ${column.tone}26`,
                  display: "grid",
                  gap: 10,
                  alignContent: "start",
                }}
              >
                <div style={{ color: column.tone, fontFamily: fonts, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                  {column.label}
                </div>
                <div style={{ display: "grid", gap: columnIndex === 0 ? 9 : 10 }}>
                  {column.rows.map((row, index) => (
                    <div
                      key={row}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "16px 1fr",
                        gap: 8,
                        alignItems: "start",
                        paddingBottom: index === column.rows.length - 1 ? 0 : 7,
                        borderBottom: index === column.rows.length - 1 ? "none" : `1px dashed ${columnIndex === 0 ? "rgba(217,106,92,0.18)" : "rgba(26,155,103,0.18)"}`,
                      }}
                    >
                      <div style={{ color: column.tone, fontFamily: fontDisplay, fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
                        {columnIndex === 0 ? "x" : "✓"}
                      </div>
                      <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.55 }}>
                        {row}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel title="Mint split" tone="#7CB7F6" glyph="⬡" pixels={INFO_PANEL_PIXELS.split}>
          <div style={{ position: "relative", paddingTop: 28 }}>
            <div style={{ display: "flex", height: 34, borderRadius: 18, overflow: "hidden", border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: "60%", background: "rgba(124,183,246,0.24)" }} />
              <div style={{ width: "10%", background: "rgba(174,139,255,0.22)" }} />
              <div style={{ width: "30%", background: "rgba(244,207,102,0.22)" }} />
            </div>
            <div style={{ position: "absolute", inset: "0 0 auto 0", display: "grid", gridTemplateColumns: "60% 10% 30%" }}>
              {["60%", "10%", "30%"].map((value) => (
                <div key={value} style={{ textAlign: "center", color: COLORS.textDim, fontFamily: fontDisplay, fontSize: 14, fontWeight: 600 }}>
                  {value}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
            {mintSplitRows.map(([title, body, tone]) => (
              <div
                key={title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(110px, 0.55fr) 1fr",
                  alignItems: "start",
                  gap: 10,
                  paddingBottom: 10,
                  borderBottom: `1px dashed ${COLORS.border}`,
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 999, background: tone, marginTop: 6 }} />
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 17, fontWeight: 600 }}>{title}</div>
                <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.65 }}>{body}</div>
              </div>
            ))}
          </div>
        </InsightPanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>
        <InsightPanel title="After you mint" tone={COLORS.green} glyph="↗" pixels={INFO_PANEL_PIXELS.afterMint}>
          <div
            style={{
              padding: 16,
              borderRadius: 24,
              border: `1px solid ${COLORS.border}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
                marginBottom: 14,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "16.666%",
                  right: "16.666%",
                  top: 16,
                  height: 2,
                  background: "linear-gradient(90deg, rgba(110,231,183,0.25), rgba(174,139,255,0.24))",
                }}
              />
              {["Market", "Pool", "Resale"].map((label, index) => (
                <div key={label} style={{ display: "grid", justifyItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      border: `1px solid ${index === 0 ? "rgba(110,231,183,0.3)" : index === 1 ? "rgba(244,207,102,0.3)" : "rgba(174,139,255,0.3)"}`,
                      background: index === 0 ? "rgba(110,231,183,0.16)" : index === 1 ? "rgba(244,207,102,0.16)" : "rgba(174,139,255,0.14)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: COLORS.text,
                      fontFamily: fontDisplay,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.08fr 0.92fr", gap: 12 }}>
              {afterMintCards.map(([title, body, background], index) => (
                <div
                  key={title}
                  style={{
                    gridColumn: index === 0 ? "1 / span 2" : "auto",
                    padding: 16,
                    borderRadius: 20,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,0.08)",
                    display: "grid",
                    gridTemplateColumns: "42px 1fr",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 14, background, border: `1px solid ${COLORS.border}` }} />
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                      <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
                        {title}
                      </div>
                      <div
                        style={{
                          padding: "5px 10px",
                          borderRadius: 999,
                          border: `1px solid ${COLORS.border}`,
                          background: "rgba(255,255,255,0.06)",
                          color: COLORS.textDim,
                          fontFamily: fonts,
                          fontSize: 10,
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        {index === 0 ? "premium" : index === 1 ? "floor lane" : "inventory"}
                      </div>
                    </div>
                    <div style={{ marginTop: 4, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                      {body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </InsightPanel>

        <InsightPanel title="Market states" tone="#E8853A" glyph="◆" pixels={INFO_PANEL_PIXELS.states}>
          <div
            style={{
              padding: 14,
              borderRadius: 24,
              border: `1px solid ${COLORS.border}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
              {marketStateRows.map(([title], index) => (
                <div
                  key={title}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 16,
                    background: `${marketStateTones[index]}12`,
                    border: `1px solid ${marketStateTones[index]}26`,
                    color: marketStateTones[index],
                    fontFamily: fontDisplay,
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {title}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "0.94fr 1.12fr 0.94fr", gap: 12 }}>
              {marketStateRows.map(([title, chip, body], index) => {
                const tone = marketStateTones[index];
                return (
                  <div
                    key={title}
                    style={{
                      padding: 16,
                      borderRadius: 20,
                      border: `1px solid ${COLORS.border}`,
                      background: "rgba(255,255,255,0.08)",
                      minHeight: 150,
                      display: "grid",
                      alignContent: "start",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 999, background: tone }} />
                          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>{title}</div>
                        </div>
                        <div style={{ marginTop: 10, width: 54, height: 6, borderRadius: 999, background: `${tone}40` }} />
                      </div>
                      <div style={{ padding: "7px 11px", borderRadius: 999, border: `1px solid ${tone}30`, background: `${tone}14`, color: tone, fontFamily: fonts, fontSize: 10, letterSpacing: 0.5 }}>
                        {chip}
                      </div>
                    </div>
                    <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                      {body}
                    </div>
                    <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                      {[0.46, 0.72, 0.32].map((opacity, chipIndex) => (
                        <div
                          key={chipIndex}
                          style={{
                            height: 8,
                            borderRadius: 999,
                            background: `${tone}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </InsightPanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, alignItems: "stretch" }}>
        <InsightPanel title="Floor bid curve" tone="#D4497A" glyph="↕" pixels={INFO_PANEL_PIXELS.curve}>
          <div
            style={{
              padding: 16,
              borderRadius: 22,
              border: `1px solid ${COLORS.border}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
            }}
          >
            <div style={{ display: "grid", gridTemplateRows: "repeat(3, 1fr)", gap: 14, marginBottom: -86, opacity: 0.42 }}>
              {[0, 1, 2].map((row) => (
                <div key={row} style={{ borderTop: `1px dashed rgba(212,73,122,0.18)` }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 86, position: "relative" }}>
              {curveBars.map((value, index) => (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    height: `${Math.max(18, value)}%`,
                    borderRadius: 8,
                    background: `rgba(212,73,122,${0.38 - index * 0.02})`,
                    minWidth: 20,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <div style={{ color: COLORS.textMuted, fontFamily: fontDisplay, fontSize: 12, fontWeight: 600 }}>60% mint price</div>
              <div style={{ color: COLORS.textMuted, fontFamily: fontDisplay, fontSize: 12, fontWeight: 600 }}>15% floor</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.8 }}>
              The floor starts at 60% of mint price and decays toward 15% as net pool sells accumulate. EMA guardrails stop abrupt collapse.
            </div>
            <div
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                border: `1px solid rgba(212,73,122,0.24)`,
                background: "rgba(212,73,122,0.10)",
                color: "#D4497A",
                fontFamily: fonts,
                fontSize: 10,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Floor only
            </div>
          </div>
        </InsightPanel>

        <InsightPanel title="Weighted staking" tone="#D4497A" glyph="›" pixels={INFO_PANEL_PIXELS.staking}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>
            <div
              style={{
                padding: 14,
                borderRadius: 20,
                border: `1px solid ${COLORS.border}`,
                background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {stakeWeights.map(([weight, lock], index) => (
                  <div key={weight} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        height: 46,
                        borderRadius: 14,
                        border: `1px solid rgba(212,73,122,0.18)`,
                        background: `linear-gradient(180deg, rgba(212,73,122,${0.08 + index * 0.03}), rgba(212,73,122,0.05))`,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: 8,
                          right: 8,
                          bottom: 8,
                          height: 6 + index * 4,
                          borderRadius: 999,
                          background: "rgba(212,73,122,0.24)",
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 10, color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>{weight}</div>
                    <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.5 }}>{lock}</div>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                padding: 16,
                borderRadius: 20,
                border: `1px solid rgba(212,73,122,0.16)`,
                background: "rgba(212,73,122,0.06)",
                display: "grid",
                alignContent: "start",
                gap: 12,
              }}
            >
              <div style={{ color: "#D4497A", fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
                Real fee flow
              </div>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, lineHeight: 1 }}>
                10%
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.85 }}>
                Stakers earn 10% of all trade fees from real trading. No emissions token, no fixed APY. Longer locks only increase weight.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {["Fee flow only", "No fixed yield", "Weight from lock time"].map((label) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.textDim, fontFamily: fonts, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(212,73,122,0.55)" }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </InsightPanel>

        <InsightPanel title="Native marketplace" tone={COLORS.green} glyph="≣" pixels={INFO_PANEL_PIXELS.market}>
          <div style={{ padding: 16, borderRadius: 18, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, lineHeight: 1.45, fontWeight: 600 }}>
            The protocol does not need OpenSea to understand its own market. V1 is designed around native trading.
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "grid", gap: 10 }}>
              {marketTiles.slice(0, 2).map(([title, body], index) => (
                <div key={title} style={{ padding: 14, borderRadius: 16, border: `1px solid ${COLORS.border}`, background: index === 0 ? "rgba(110,231,183,0.08)" : "rgba(255,255,255,0.08)" }}>
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>{title}</div>
                  <div style={{ marginTop: 5, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.65 }}>{body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {marketTiles.slice(2).map(([title, body]) => (
                <div key={title} style={{ padding: 14, borderRadius: 16, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.08)" }}>
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>{title}</div>
                  <div style={{ marginTop: 5, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.65 }}>{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, paddingTop: 12, borderTop: `1px dashed ${COLORS.border}` }}>
            {[
              "Rolling 24h sales count",
              "Active listing count",
              "Market floor signal",
            ].map((label, index) => (
              <div
                key={label}
                style={{
                  color: COLORS.textDim,
                  fontFamily: fonts,
                  fontSize: 11,
                  lineHeight: 1.55,
                  paddingTop: 4,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </InsightPanel>
      </div>

      <InsightPanel title="Honest FAQ" tone="#E8853A" glyph="?" pixels={INFO_PANEL_PIXELS.faq}>
        <div style={{ display: "grid", gap: 12 }}>
          {faqRows.map(([question, answer], index) => (
            <div
              key={question}
              style={{
                padding: "16px 18px 18px",
                borderRadius: 22,
                border: `1px solid ${COLORS.border}`,
                background: index === 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)",
                display: "grid",
                gap: 8,
                boxShadow: index === 0 ? "0 14px 28px rgba(0,0,0,0.03)" : "none",
              }}
            >
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
                {question}
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.8 }}>
                {answer}
              </div>
            </div>
          ))}
        </div>
      </InsightPanel>
    </div>
  );
}

export default function HomePage({ setPage, pool, isLive, poolError }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        margin: "0 auto",
        padding: "118px 12px 64px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <MarqueeStyles />
      <HomePixelBackdrop />

      <div style={{ position: "relative", zIndex: 1 }}>
        <HeroGallery pool={pool} />

        <div className="site-reveal-soft" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "center", ...revealStyle(320) }}>
          <MetalButton onClick={() => setPage("mint")} tone="accent" active style={{ cursor: "pointer" }}>
            Mint NFT
          </MetalButton>
          <MetalButton onClick={() => setPage("market")} tone="green" active style={{ cursor: "pointer" }}>
            Explore market
          </MetalButton>
          <MetalButton onClick={() => setPage("staking")} tone="purple" active style={{ cursor: "pointer" }}>
            Stake fee flow
          </MetalButton>
        </div>

        <LiquiditySystemOverview className="site-reveal" style={{ marginTop: 22, ...revealStyle(620) }} />
      </div>
    </div>
  );
}
