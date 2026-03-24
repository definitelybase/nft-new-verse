import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#0A0A0F",
  bgCard: "#12121A",
  bgHover: "#1A1A25",
  border: "#1E1E2E",
  borderHover: "#2A2A3E",
  accent: "#5B8EC9",
  accentDim: "#3A6090",
  green: "#22C55E",
  greenDim: "#166534",
  red: "#EF4444",
  redDim: "#991B1B",
  yellow: "#EAB308",
  purple: "#8B5CF6",
  text: "#E8E8F0",
  textMuted: "#6B6B80",
  textDim: "#44445A",
};

const fonts = `'JetBrains Mono', 'Fira Code', monospace`;
const fontDisplay = `'Space Grotesk', 'Syne', sans-serif`;

// Mock data
const MOCK_POOL = {
  ethBalance: 52.35,
  virtualEth: 52.35,
  virtualNft: 9847,
  floor: 0.00532,
  sellPrice: 0.00531,
  buyPrice: 0.00533,
  totalMinted: 4200,
  totalStaked: 1180,
  poolNfts: 153,
  circulating: 2867,
  emc: 78.42,
  liqRatio: 66.8,
  protocolFees: 3.82,
  dailyVolume: 12.4,
  trades24h: 89,
};

const MOCK_NFTS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  rarity: i < 2 ? "Legendary" : i < 5 ? "Epic" : i < 8 ? "Rare" : "Common",
  price: (MOCK_POOL.floor * (i < 2 ? 10 : i < 5 ? 3 : i < 8 ? 1.5 : 1)).toFixed(5),
  colors: Array.from({ length: 16 }, () =>
    ["#2A1506","#E8B87A","#D4A56A","#3368BB","#2855A0","#5B8EC9","#C44040","#FFFFFF","#3B6B35","#000000","#FF00FF","#00FFFF","#888888","#CCCCCC","#22C55E","#FFD700"][Math.floor(Math.random()*16)]
  )
}));

function PixelAvatar({ size = 48, seed = 0 }) {
  const grid = 8;
  const px = size / grid;
  const colors = ["#2A1506","#E8B87A","#D4A56A","#3368BB","#5B8EC9","#C44040","#FFF","#3B6B35","#000","#22C55E","#8B5CF6","#FFD700"];
  const rng = (s) => { let h = s|0; return () => { h = Math.imul(h^(h>>>16),0x45d9f3b); h = Math.imul(h^(h>>>13),0x45d9f3b); return ((h^(h>>>16))>>>0)/4294967296; }};
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
      if (y === 4 && x >= 1 && x <= 6) { c = skin; if (x === 3 || x === 4) c = "#D4A56A"; }
      if (y === 5 && x >= 2 && x <= 5) { c = skin; if (x === 3 || x === 4) c = "#C44040"; }
      if (y >= 6 && x >= 1 && x <= 6) c = shirt;
      map.push({ x: x * px, y: y * px, c });
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 4, imageRendering: "pixelated" }}>
      {map.map((p, i) => <rect key={i} x={p.x} y={p.y} width={px} height={px} fill={p.c} />)}
    </svg>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase", fontFamily: fonts, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || COLORS.text, fontFamily: fonts }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: fonts }}>{sub}</div>}
    </div>
  );
}

function PoolViz({ pool }) {
  const ethPct = Math.min((pool.ethBalance / (pool.ethBalance + 20)) * 100, 95);
  const nftPct = Math.min((pool.poolNfts / (pool.poolNfts + 200)) * 100, 95);
  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24 }}>
      <div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: fonts, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Liquidity pool</div>
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: COLORS.accent, fontFamily: fonts, marginBottom: 6 }}>ETH Reserve</div>
          <div style={{ height: 8, background: COLORS.bg, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${ethPct}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.purple})`, borderRadius: 4, transition: "width 1s" }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, fontFamily: fonts, marginTop: 8 }}>{pool.ethBalance.toFixed(2)} ETH</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: COLORS.green, fontFamily: fonts, marginBottom: 6 }}>NFTs in Pool</div>
          <div style={{ height: 8, background: COLORS.bg, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${nftPct}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.yellow})`, borderRadius: 4, transition: "width 1s" }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, fontFamily: fonts, marginTop: 8 }}>{pool.poolNfts} NFTs</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${COLORS.border}` }}>
        <div><div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: fonts }}>SELL PRICE</div><div style={{ fontSize: 16, color: COLORS.red, fontFamily: fonts, fontWeight: 600 }}>{pool.sellPrice} ETH</div></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: fonts }}>FLOOR</div><div style={{ fontSize: 20, color: COLORS.yellow, fontFamily: fonts, fontWeight: 700 }}>{pool.floor} ETH</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: fonts }}>BUY PRICE</div><div style={{ fontSize: 16, color: COLORS.green, fontFamily: fonts, fontWeight: 600 }}>{pool.buyPrice} ETH</div></div>
      </div>
    </div>
  );
}

function Nav({ page, setPage }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "mint", label: "Mint" },
    { id: "market", label: "Marketplace" },
  ];
  return (
    <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: `1px solid ${COLORS.border}`, background: "rgba(10,10,15,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`, borderRadius: 6 }} />
        <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, fontFamily: fonts, letterSpacing: -0.5 }}>OnChainPixel</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {items.map(it => (
          <button key={it.id} onClick={() => setPage(it.id)} style={{
            background: page === it.id ? COLORS.bgCard : "transparent",
            border: page === it.id ? `1px solid ${COLORS.border}` : "1px solid transparent",
            color: page === it.id ? COLORS.text : COLORS.textMuted,
            padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: fonts, fontSize: 13, fontWeight: 500, transition: "all 0.2s"
          }}>{it.label}</button>
        ))}
      </div>
      <button style={{
        background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`,
        border: "none", color: "#fff", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontFamily: fonts, fontSize: 13, fontWeight: 600
      }}>Connect Wallet</button>
    </nav>
  );
}

function MintPage() {
  const [mintType, setMintType] = useState("public");
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      {/* Hero banner */}
      <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 40, position: "relative", height: 340, background: `linear-gradient(135deg, #0D1520 0%, #162030 50%, #0D1520 100%)`, border: `1px solid ${COLORS.border}` }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", padding: 40, opacity: 0.25 }}>
          {Array.from({ length: 40 }, (_, i) => <PixelAvatar key={i} size={56} seed={i + 100} />)}
        </div>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, rgba(10,10,15,0.8) 100%)" }} />
        <div style={{ position: "absolute", bottom: 32, left: 32, right: 32, zIndex: 2 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.text, fontFamily: fonts, lineHeight: 1.1 }}>OnChainPixel</div>
          <div style={{ fontSize: 16, color: COLORS.textMuted, fontFamily: fonts, marginTop: 8 }}>10,000 fully on-chain pixel art PFPs with built-in AMM liquidity</div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: COLORS.accent, fontFamily: fonts }}>24×24 pixels</div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: COLORS.green, fontFamily: fonts }}>Fully on-chain</div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, color: COLORS.purple, fontFamily: fonts }}>Instant liquidity</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32 }}>
        {/* Left: info */}
        <div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
            <StatCard label="Total Supply" value="10,000" />
            <StatCard label="Minted" value="4,200 / 10K" color={COLORS.accent} />
            <StatCard label="Unique Holders" value="2,340" />
          </div>

          {/* Gallery preview */}
          <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: fonts, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Recent mints</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} style={{ background: COLORS.bg, borderRadius: 8, padding: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PixelAvatar size={64} seed={i * 37 + 7} />
                </div>
              ))}
            </div>
          </div>

          {/* Price table */}
          <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginTop: 24 }}>
            <div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: fonts, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>Pricing</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fonts, fontSize: 14 }}>
              <thead><tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <th style={{ textAlign: "left", padding: "10px 0", color: COLORS.textMuted, fontWeight: 500, fontSize: 12 }}>Phase</th>
                <th style={{ textAlign: "left", padding: "10px 0", color: COLORS.textMuted, fontWeight: 500, fontSize: 12 }}>Price</th>
                <th style={{ textAlign: "left", padding: "10px 0", color: COLORS.textMuted, fontWeight: 500, fontSize: 12 }}>Supply</th>
                <th style={{ textAlign: "right", padding: "10px 0", color: COLORS.textMuted, fontWeight: 500, fontSize: 12 }}>Status</th>
              </tr></thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "12px 0", color: COLORS.text }}>Allowlist</td>
                  <td style={{ padding: "12px 0", color: COLORS.green, fontWeight: 600 }}>0.005 ETH</td>
                  <td style={{ padding: "12px 0", color: COLORS.textMuted }}>2,000</td>
                  <td style={{ padding: "12px 0", textAlign: "right" }}><span style={{ background: COLORS.greenDim, color: COLORS.green, padding: "4px 10px", borderRadius: 6, fontSize: 11 }}>Sold out</span></td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "12px 0", color: COLORS.text }}>Public</td>
                  <td style={{ padding: "12px 0", color: COLORS.yellow, fontWeight: 600 }}>0.01 ETH</td>
                  <td style={{ padding: "12px 0", color: COLORS.textMuted }}>8,000</td>
                  <td style={{ padding: "12px 0", textAlign: "right" }}><span style={{ background: "rgba(234,179,8,0.15)", color: COLORS.yellow, padding: "4px 10px", borderRadius: 6, fontSize: 11 }}>Live</span></td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 12, fontFamily: fonts }}>50% of mint revenue → liquidity pool automatically</div>
          </div>
        </div>

        {/* Right: mint panel */}
        <div style={{ position: "sticky", top: 80, alignSelf: "start" }}>
          <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, fontFamily: fonts, marginBottom: 20 }}>Mint your pixel</div>
            
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["allowlist", "public"].map(t => (
                <button key={t} onClick={() => setMintType(t)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, cursor: "pointer", fontFamily: fonts, fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                  background: mintType === t ? COLORS.accent : "transparent",
                  border: `1px solid ${mintType === t ? COLORS.accent : COLORS.border}`,
                  color: mintType === t ? "#fff" : COLORS.textMuted,
                }}>{t}</button>
              ))}
            </div>

            <div style={{ background: COLORS.bg, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: fonts }}>Price</span>
                <span style={{ fontSize: 14, color: COLORS.text, fontFamily: fonts, fontWeight: 600 }}>{mintType === "allowlist" ? "0.005" : "0.01"} ETH</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: fonts }}>→ Creator</span>
                <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: fonts }}>50%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: COLORS.green, fontFamily: fonts }}>→ Liquidity Pool</span>
                <span style={{ fontSize: 12, color: COLORS.green, fontFamily: fonts, fontWeight: 600 }}>50%</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 18, cursor: "pointer", fontFamily: fonts }}>−</button>
              <div style={{ flex: 1, textAlign: "center", fontSize: 28, fontWeight: 700, color: COLORS.text, fontFamily: fonts }}>1</div>
              <button style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: 18, cursor: "pointer", fontFamily: fonts }}>+</button>
            </div>

            <button style={{
              width: "100%", padding: "16px 0", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: fonts, fontSize: 16, fontWeight: 700, color: "#fff",
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`,
            }}>Mint for 0.01 ETH</button>

            <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center", marginTop: 12, fontFamily: fonts }}>
              Pixel art generated on-chain • Stored forever in Ethereum
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketplacePage() {
  const pool = MOCK_POOL;
  const [tab, setTab] = useState("buy");
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      {/* Top stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Floor Price" value={`${pool.floor} ETH`} sub={`$${(pool.floor * 2000).toFixed(2)}`} color={COLORS.yellow} />
        <StatCard label="Effective Market Cap" value={`${pool.emc.toFixed(1)} ETH`} sub={`$${(pool.emc * 2000).toLocaleString()}`} color={COLORS.accent} />
        <StatCard label="Liquidity Ratio" value={`${pool.liqRatio}%`} sub="Pool ETH / EMC" color={COLORS.green} />
        <StatCard label="24h Volume" value={`${pool.dailyVolume} ETH`} sub={`${pool.trades24h} trades`} color={COLORS.purple} />
      </div>

      {/* Pool visualization */}
      <PoolViz pool={pool} />

      {/* Supply breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, margin: "24px 0" }}>
        <StatCard label="Circulating" value={pool.circulating.toLocaleString()} sub="On market" />
        <StatCard label="Staked" value={pool.totalStaked.toLocaleString()} sub="Earning fees" color={COLORS.green} />
        <StatCard label="In Pool" value={pool.poolNfts.toString()} sub="Available to buy" color={COLORS.accent} />
        <StatCard label="Protocol Fees" value={`${pool.protocolFees} ETH`} sub="Accumulated" color={COLORS.purple} />
      </div>

      {/* Buy/Sell toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["buy", "sell", "stake"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 28px", borderRadius: 10, cursor: "pointer", fontFamily: fonts, fontSize: 14, fontWeight: 600, textTransform: "capitalize",
            background: tab === t ? (t === "buy" ? COLORS.green : t === "sell" ? COLORS.red : COLORS.purple) : "transparent",
            border: `1px solid ${tab === t ? "transparent" : COLORS.border}`,
            color: tab === t ? "#fff" : COLORS.textMuted,
          }}>{t} NFT</button>
        ))}
      </div>

      {/* NFT Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {MOCK_NFTS.map(nft => (
          <div key={nft.id} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 12, cursor: "pointer", transition: "border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.borderHover}
            onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}>
            <div style={{ background: COLORS.bg, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <PixelAvatar size={96} seed={nft.id * 131 + 42} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, fontFamily: fonts }}>#{nft.id}</span>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, fontFamily: fonts, fontWeight: 600,
                background: nft.rarity === "Legendary" ? "rgba(234,179,8,0.15)" : nft.rarity === "Epic" ? "rgba(139,92,246,0.15)" : nft.rarity === "Rare" ? "rgba(91,142,201,0.15)" : "rgba(107,107,128,0.15)",
                color: nft.rarity === "Legendary" ? COLORS.yellow : nft.rarity === "Epic" ? COLORS.purple : nft.rarity === "Rare" ? COLORS.accent : COLORS.textMuted
              }}>{nft.rarity}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, fontFamily: fonts, marginTop: 6 }}>{nft.price} ETH</div>
            <button style={{
              width: "100%", marginTop: 10, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: fonts, fontSize: 12, fontWeight: 600,
              background: tab === "buy" ? COLORS.green : tab === "sell" ? COLORS.red : COLORS.purple,
              color: "#fff"
            }}>{tab === "buy" ? "Buy" : tab === "sell" ? "Sell" : "Stake"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 80 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {Array.from({ length: 7 }, (_, i) => <PixelAvatar key={i} size={64} seed={i * 53 + 11} />)}
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 800, color: COLORS.text, fontFamily: fonts, lineHeight: 1.1, margin: 0 }}>Permanent art.<br/>Instant liquidity.</h1>
        <p style={{ fontSize: 18, color: COLORS.textMuted, fontFamily: fonts, marginTop: 20, lineHeight: 1.6, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
          The first NFT collection with images stored entirely in Ethereum and a built-in AMM that guarantees you can always sell.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 32 }}>
          <button style={{ padding: "14px 36px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: fonts, fontSize: 15, fontWeight: 700, color: "#fff", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})` }}>Mint now</button>
          <button style={{ padding: "14px 36px", borderRadius: 12, border: `1px solid ${COLORS.border}`, cursor: "pointer", fontFamily: fonts, fontSize: 15, fontWeight: 600, color: COLORS.text, background: "transparent" }}>Read GitBook</button>
        </div>
      </div>

      {/* Features */}
      {[
        { title: "On-chain forever", desc: "Pixel data stored as contract bytecode via SSTORE2. No IPFS. No AWS. Your art lives as long as Ethereum exists. Every pixel rendered to SVG on-chain.", icon: "◆" },
        { title: "Built-in liquidity", desc: "50% of every mint goes to an AMM pool. The smart contract is always ready to buy your NFT instantly. No waiting for buyers, no dead floor.", icon: "◈" },
        { title: "Honest market cap", desc: "We don't use fake floor × supply. Our Effective Market Cap counts real ETH in the pool, circulating supply, and staked NFTs. All verifiable on-chain.", icon: "◇" },
        { title: "Stake & earn", desc: "Lock your NFT in the pool to earn 1.25% of every trade. The more volume, the more you earn. Unstake anytime.", icon: "⬡" },
      ].map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 24, marginBottom: 48, alignItems: "flex-start" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: COLORS.accent, flexShrink: 0 }}>{f.icon}</div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, fontFamily: fonts, margin: "0 0 8px" }}>{f.title}</h3>
            <p style={{ fontSize: 15, color: COLORS.textMuted, fontFamily: fonts, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
          </div>
        </div>
      ))}

      {/* Numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "64px 0", padding: 32, background: COLORS.bgCard, borderRadius: 20, border: `1px solid ${COLORS.border}` }}>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 32, fontWeight: 800, color: COLORS.accent, fontFamily: fonts }}>$0.06</div><div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: fonts, marginTop: 4 }}>Cost to mint 24×24</div></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 32, fontWeight: 800, color: COLORS.green, fontFamily: fonts }}>2.5%</div><div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: fonts, marginTop: 4 }}>Trade fee (50% to stakers)</div></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 32, fontWeight: 800, color: COLORS.purple, fontFamily: fonts }}>576</div><div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: fonts, marginTop: 4 }}>Pixels per NFT, all on-chain</div></div>
      </div>

      {/* Links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 64 }}>
        {[
          { label: "GitBook", desc: "Full documentation", url: "#" },
          { label: "GitHub", desc: "Smart contracts (open source)", url: "#" },
          { label: "EIP Draft", desc: "On-Chain Pixel Art Standard", url: "#" },
          { label: "Etherscan", desc: "Verified contracts", url: "#" },
        ].map((l, i) => (
          <a key={i} href={l.url} style={{ display: "block", textDecoration: "none", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px 24px", transition: "border-color 0.2s", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, fontFamily: fonts }}>{l.label} →</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, fontFamily: fonts, marginTop: 4 }}>{l.desc}</div>
          </a>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "32px 0", borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 13, color: COLORS.textDim, fontFamily: fonts }}>OnChainPixel — Permanent Art. Instant Liquidity. Honest Value.</div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <Nav page={page} setPage={setPage} />
      {page === "home" && <HomePage />}
      {page === "mint" && <MintPage />}
      {page === "market" && <MarketplacePage />}
    </div>
  );
}
