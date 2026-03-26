import React, { useEffect, useMemo, useState } from "react";
import { Contract } from "ethers-v6";
import { ERC721_ABI, PIXEL_ROUTER_ABI } from "../pixelRouterAbi";
import { MetalButton } from "../MetalButton";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { FEATURED_COLLECTION_IDS, GENERATED_COLLECTION } from "../utils/generatedCollection";
import { checkChain, fmtEth, revealStyle } from "../utils/helpers";
import { DataBadge, Eyebrow, FrostCard, PoolViz, TxStatusBar, WrongChainBanner } from "../components/ui";

export default function MarketplacePage({ pool, isLive, wallet, appConfig, poolError }) {
  const [tab, setTab] = useState("listing");
  const [sellTokenId, setSellTokenId] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collectionTab, setCollectionTab] = useState("items");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState("price-low");
  const [searchQuery, setSearchQuery] = useState("");
  const [gridDensity, setGridDensity] = useState(4);
  const [isCompactMarketLayout, setIsCompactMarketLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1080 : false
  );

  const routerAddress = appConfig?.routerAddress || "";
  const nftAddress = appConfig?.nftAddress || "";
  const collectionSupply = GENERATED_COLLECTION.length;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function updateLayoutMode() {
      setIsCompactMarketLayout(window.innerWidth < 1080);
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  const marketItems = useMemo(() => {
    const baseFloor = Number(pool.floor || 0);
    const fallbackFloor = 0.0425;
    const anchor = baseFloor > 0 ? baseFloor : fallbackFloor;
    const tierMultiplier = {
      Common: 1,
      Uncommon: 1.06,
      Rare: 1.16,
      Epic: 1.34,
      Legendary: 1.58,
    };

    return GENERATED_COLLECTION.map((item, index) => {
      const listed = index % 11 !== 0;
      const inPool = index % 19 === 0;
      const motion = 1 + ((index % 7) - 3) * 0.015 + ((item.id % 5) - 2) * 0.006;
      const price = Number((anchor * (tierMultiplier[item.tier] || 1) * motion).toFixed(4));
      const lastSale = Number((price * (0.9 + (index % 4) * 0.025)).toFixed(4));

      return {
        ...item,
        listed,
        inPool,
        price,
        lastSale,
        image: `/collection/images/${item.id}.svg`,
      };
    });
  }, [pool.floor]);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = marketItems.filter((item) => {
      if (statusFilter === "listed" && !item.listed) return false;
      if (statusFilter === "pool" && !item.inPool) return false;
      if (!query) return true;
      const haystack = `#${item.id} ${item.base} ${item.background} ${item.hair} ${item.eyes} ${item.mouth} ${item.shirt} ${item.accessory} ${item.tier}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered];
    if (sortMode === "price-high") sorted.sort((a, b) => b.price - a.price);
    if (sortMode === "recent") sorted.sort((a, b) => b.id - a.id);
    if (sortMode === "price-low") sorted.sort((a, b) => a.price - b.price);
    return sorted;
  }, [marketItems, searchQuery, sortMode, statusFilter]);

  const traitCounts = useMemo(() => {
    const countBy = (key) =>
      marketItems.reduce((acc, item) => {
        acc[item[key]] = (acc[item[key]] || 0) + 1;
        return acc;
      }, {});
    return {
      base: countBy("base"),
      background: countBy("background"),
      hair: countBy("hair"),
    };
  }, [marketItems]);

  const marketGridColumns = useMemo(() => {
    if (gridDensity === 16) return "1fr";
    if (isCompactMarketLayout) {
      if (gridDensity === 8) return "repeat(3, minmax(0, 1fr))";
      return "repeat(2, minmax(0, 1fr))";
    }
    return `repeat(${gridDensity}, minmax(0, 1fr))`;
  }, [gridDensity, isCompactMarketLayout]);

  const isDenseGrid = gridDensity === 8;
  const isListView = gridDensity === 16;

  async function handleSell() {
    if (!wallet?.provider || !wallet?.account) {
      setTxStatus("Connect wallet first.");
      return;
    }
    if (!routerAddress || !nftAddress) {
      setTxStatus("Router or NFT address not set.");
      return;
    }
    const chainErr = checkChain(wallet, appConfig);
    if (chainErr) {
      setTxStatus(chainErr);
      return;
    }
    if (!pool.canSell) {
      setTxStatus("Pool selling is currently disabled (need post-launch + coverage).");
      return;
    }

    const tokenId = parseInt(sellTokenId, 10);
    if (Number.isNaN(tokenId) || tokenId < 0) {
      setTxStatus("Enter a valid token ID.");
      return;
    }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus("Checking ownership and approval...");
      const signer = await wallet.provider.getSigner();
      const nft = new Contract(nftAddress, ERC721_ABI, signer);
      const router = new Contract(routerAddress, PIXEL_ROUTER_ABI, signer);

      const owner = await nft.ownerOf(tokenId);
      if (owner.toLowerCase() !== wallet.account.toLowerCase()) {
        setTxStatus(`You don't own token #${tokenId}.`);
        setIsSubmitting(false);
        return;
      }

      const approved = await nft.isApprovedForAll(wallet.account, routerAddress);
      if (!approved) {
        setTxStatus("Approving router to transfer your NFT...");
        const approveTx = await nft.setApprovalForAll(routerAddress, true);
        await approveTx.wait();
      }

      const prices = await router.getPrices();
      const sellPrice = prices.sellPrice;
      if (sellPrice === 0n) {
        setTxStatus("Current sell quote is unavailable.");
        return;
      }

      const minPrice = sellPrice - sellPrice / 100n;
      setTxStatus("Selling with 1% slippage buffer. Confirm in wallet...");
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
              <img
                src={`/collection/images/${FEATURED_COLLECTION_IDS[0]}.svg`}
                alt="OnChainPixel featured token"
                style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated", display: "block" }}
              />
            </div>
            <div>
              <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 34, fontWeight: 600, letterSpacing: -1.2 }}>
                OnChainPixel Genesis
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Eyebrow tone="accent">Ethereum</Eyebrow>
                <Eyebrow tone="purple">{collectionSupply.toLocaleString()} generated</Eyebrow>
                <Eyebrow tone="green">Fully on-chain</Eyebrow>
              </div>
              <div style={{ marginTop: 10, color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, lineHeight: 1.7, maxWidth: 520 }}>
                Discovery layer for the collection, now fed by the real generated batch instead of placeholder avatars. The native market grid shows the actual pixel pieces that power the protocol.
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
              ["Base", traitCounts.base],
              ["Background", traitCounts.background],
              ["Hair", traitCounts.hair],
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
              The pool is the instant-exit layer. Discovery and premium pricing stay in the native market, while protocol inventory is routed into the protocol marketplace once the spread is attractive enough.
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 16, background: COLORS.surfaceStrong }}>
                <div style={{ color: COLORS.green, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Listing lane</div>
                <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                  Protocol inventory can be released into the native marketplace once stabilization conditions are met.
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
            <div style={{ display: "grid", gridTemplateColumns: isCompactMarketLayout ? "1fr" : "minmax(0,1fr) auto auto auto", gap: 10, alignItems: "center" }}>
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

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px",
                  borderRadius: 18,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.surfaceStrong,
                }}
              >
                {[4, 8, 16].map((density) => (
                  <MetalButton
                    key={density}
                    onClick={() => setGridDensity(density)}
                    tone="ghost"
                    active={gridDensity === density}
                    size="xs"
                    style={{
                      minWidth: 42,
                      padding: "8px 10px",
                      opacity: gridDensity === density ? 1 : 0.84,
                    }}
                  >
                    {density}
                  </MetalButton>
                ))}
              </div>

              <FrostCard style={{ padding: "11px 14px", background: COLORS.surfaceStrong, borderRadius: 18 }}>
                <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11 }}>
                  {visibleItems.length} visible / {collectionSupply.toLocaleString()} total
                </div>
              </FrostCard>
            </div>
          </FrostCard>

          <PoolViz className="site-reveal" style={revealStyle(260)} pool={pool} fmtEth={fmtEth} />

          <FrostCard className="site-reveal" style={{ padding: 20, ...revealStyle(300) }}>
            <div className="site-reveal-soft" style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              {[
                ["listing", "Protocol listings"],
                ["sell", "Sell to pool"],
              ].map(([type, label]) => (
                <MetalButton
                  key={type}
                  onClick={() => {
                    setTab(type);
                    setTxStatus("");
                    setTxHash("");
                  }}
                  tone={type === "listing" ? "green" : "red"}
                  active={tab === type}
                  size="sm"
                  style={{ padding: "11px 18px", textTransform: "capitalize" }}
                >
                  {label}
                </MetalButton>
              ))}
              <DataBadge isLive={isLive} error={poolError} />
            </div>

            {tab === "listing" ? (
              <div>
                <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
                  Protocol listing lane
                </div>
                <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
                  The protocol no longer sells inventory directly out of the pool. Instead, inventory that came in through floor bids is released into the native marketplace once the market stabilizes and the listing spread is healthy enough.
                  {!pool.listingEnabled ? <span style={{ color: COLORS.yellow }}> Listing release opens only in stabilization with inventory ready.</span> : null}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isCompactMarketLayout ? "1fr" : "repeat(3, 1fr)", gap: 12, marginTop: 16, alignItems: "stretch" }}>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Listing reference</div>
                    <div style={{ marginTop: 8, color: COLORS.green, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.listingPrice ? fmtEth(pool.listingPrice) : "—"}</div>
                  </FrostCard>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Inventory</div>
                    <div style={{ marginTop: 8, color: COLORS.text, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.poolNfts}</div>
                  </FrostCard>
                  <FrostCard style={{ padding: 14, background: COLORS.surfaceStrong, borderRadius: 18, minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Lane status</div>
                    <div style={{ marginTop: 8, color: COLORS.purple, fontFamily: fontDisplay, fontSize: 22, fontWeight: 600 }}>{pool.listingEnabled ? "Open" : "Closed"}</div>
                  </FrostCard>
                </div>

                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 18 }}>
                    <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
                      How it works now
                    </div>
                    <div style={{ marginTop: 8, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.8 }}>
                      Holders still exit through the protocol floor bid. But once inventory accumulates, the protocol routes that inventory into the native marketplace instead of selling it directly out of the pool. Rare pieces keep their premium in open price discovery.
                    </div>
                  </FrostCard>
                  <FrostCard style={{ padding: 16, background: COLORS.surfaceStrong, borderRadius: 18 }}>
                    <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Current policy</div>
                    <div style={{ marginTop: 8, color: COLORS.text, fontFamily: fonts, fontSize: 11, lineHeight: 1.8 }}>
                      Release is allowed only in stabilization, with inventory on hand, and uses the protocol listing reference rather than a direct on-chain retail checkout.
                    </div>
                  </FrostCard>
                  <WrongChainBanner wallet={wallet} appConfig={appConfig} />
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
                    onChange={(event) => setSellTokenId(event.target.value)}
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
                  <WrongChainBanner wallet={wallet} appConfig={appConfig} />
                  <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
                </div>
              </div>
            )}
          </FrostCard>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: marketGridColumns,
              gap: isListView ? 8 : 12,
            }}
          >
            {isListView ? (
              <FrostCard
                className="site-reveal-soft"
                style={{
                  padding: 0,
                  overflow: "hidden",
                  ...revealStyle(340),
                }}
              >
                {!isCompactMarketLayout ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 2.4fr) 0.9fr 1fr 1fr auto",
                      gap: 16,
                      padding: "12px 18px",
                      borderBottom: `1px solid ${COLORS.border}`,
                      color: COLORS.textDim,
                      fontFamily: fonts,
                      fontSize: 10,
                      letterSpacing: 1.1,
                      textTransform: "uppercase",
                    }}
                  >
                    <div>Item</div>
                    <div>Tier</div>
                    <div>Price</div>
                    <div>Last sale</div>
                    <div>Status</div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 0 }}>
                  {visibleItems.map((item, index) => {
                    const selected = String(item.id) === String(sellTokenId);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSellTokenId(String(item.id))}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isCompactMarketLayout ? "minmax(0, 1.8fr) auto auto" : "minmax(0, 2.4fr) 0.9fr 1fr 1fr auto",
                          gap: 16,
                          alignItems: "center",
                          padding: isCompactMarketLayout ? "12px 14px" : "14px 18px",
                          border: "none",
                          borderTop: index === 0 && isCompactMarketLayout ? "none" : `1px solid ${COLORS.border}`,
                          background: selected ? COLORS.surfaceStrong : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        title={`${item.name} · ${item.tier} · ${item.base} · ${item.hair} · ${item.background}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 12,
                              overflow: "hidden",
                              flexShrink: 0,
                              background: item.inPool ? COLORS.accentSoft : COLORS.surfaceStrong,
                              border: `1px solid ${selected ? COLORS.borderStrong : COLORS.border}`,
                            }}
                          >
                            <img
                              src={item.image}
                              alt={item.name}
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
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: COLORS.text,
                                fontFamily: fontDisplay,
                                fontSize: 18,
                                fontWeight: 600,
                                lineHeight: 1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.name}
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                color: COLORS.textMuted,
                                fontFamily: fonts,
                                fontSize: 10,
                                lineHeight: 1.4,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.base} · {item.hair} · {item.background}
                            </div>
                          </div>
                        </div>

                        {!isCompactMarketLayout ? (
                          <div
                            style={{
                              color: item.tier === "Legendary" ? COLORS.yellow : item.tier === "Epic" ? COLORS.purple : COLORS.text,
                              fontFamily: fontDisplay,
                              fontSize: 17,
                              fontWeight: 600,
                            }}
                          >
                            {item.tier}
                          </div>
                        ) : null}

                        <div
                          style={{
                            color: COLORS.text,
                            fontFamily: fontDisplay,
                            fontSize: isCompactMarketLayout ? 16 : 18,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.price.toFixed(4)} ETH
                        </div>

                        {!isCompactMarketLayout ? (
                          <div
                            style={{
                              color: COLORS.textMuted,
                              fontFamily: fonts,
                              fontSize: 12,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.lastSale.toFixed(4)} ETH
                          </div>
                        ) : null}

                        <div
                          style={{
                            justifySelf: isCompactMarketLayout ? "end" : "start",
                            padding: "5px 10px",
                            borderRadius: 999,
                            background: item.inPool ? COLORS.accentSoft : item.listed ? COLORS.greenSoft : COLORS.surfaceStrong,
                            color: item.inPool ? COLORS.accent : item.listed ? COLORS.green : COLORS.textDim,
                            fontFamily: fonts,
                            fontSize: 10,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.inPool ? "Pool" : item.listed ? "Listed" : "Held"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </FrostCard>
            ) : (
              visibleItems.map((item, index) => {
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
                    title={`${item.name} · ${item.tier} · ${item.base} · ${item.hair} · ${item.background}`}
                  >
                    {isDenseGrid ? (
                      <>
                        <div style={{ padding: 12, background: item.inPool ? COLORS.accentSoft : COLORS.surfaceStrong, display: "grid", placeItems: "center", aspectRatio: "1 / 1" }}>
                          <img
                            src={item.image}
                            alt={item.name}
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
                        <div style={{ padding: 12, display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  color: COLORS.text,
                                  fontFamily: fontDisplay,
                                  fontSize: 15,
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  marginTop: 4,
                                  color: COLORS.textMuted,
                                  fontFamily: fonts,
                                  fontSize: 10,
                                  lineHeight: 1.25,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {item.base} · {item.hair}
                              </div>
                            </div>
                            <div
                              style={{
                                padding: "4px 7px",
                                borderRadius: 999,
                                background: item.inPool ? COLORS.accentSoft : item.listed ? COLORS.greenSoft : COLORS.surfaceStrong,
                                color: item.inPool ? COLORS.accent : item.listed ? COLORS.green : COLORS.textDim,
                                fontFamily: fonts,
                                fontSize: 9,
                                letterSpacing: 0.8,
                                textTransform: "uppercase",
                                flexShrink: 0,
                              }}
                            >
                              {item.inPool ? "Pool" : item.tier}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600, lineHeight: 1 }}>
                              {item.price.toFixed(4)} ETH
                            </div>
                            <div style={{ marginTop: 4, color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, lineHeight: 1.25 }}>
                              Last sale {item.lastSale.toFixed(4)} ETH
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ padding: 14, background: item.inPool ? COLORS.accentSoft : COLORS.surfaceStrong, display: "grid", placeItems: "center", aspectRatio: "1 / 1" }}>
                          <img
                            src={item.image}
                            alt={item.name}
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
                        <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", gap: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 19, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {item.name}
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
                              {item.inPool ? "Pool" : item.listed ? item.tier : "Held"}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Eyebrow tone="purple">{item.base}</Eyebrow>
                            <Eyebrow tone="accent">{item.hair}</Eyebrow>
                            <Eyebrow tone="green">{item.background}</Eyebrow>
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
                              <div>{item.eyes} eyes · {item.mouth}</div>
                              <div>{item.shirt}</div>
                              <div>{item.accessory !== "none" ? item.accessory : "no accessory"}</div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </FrostCard>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
