import React, { useEffect, useMemo, useState } from "react";
import { Contract, dataLength, getBytes, isHexString } from "ethers-v6";
import { PIXEL_ROUTER_ABI } from "../pixelRouterAbi";
import { MetalButton } from "../MetalButton";
import { COLORS, DEFAULT_PREVIEW_PALETTE, MINT_TARGET_SUPPLY, fonts, fontDisplay } from "../utils/constants";
import { checkChain, getTargetChainLabel, isValidMintPayload, readStoredMintPayload, revealStyle } from "../utils/helpers";
import { DataBadge, Eyebrow, FrostCard, MetricPanel, TxStatusBar, WrongChainBanner } from "../components/ui";

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

  const bytes = getBytes(payloadHex);
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
  const decodedGrid = useMemo(() => decodeMintPayloadGrid(payloadHex), [payloadHex]);
  const showDecodedGrid = useMemo(() => hasVisiblePayloadPixels(decodedGrid), [decodedGrid]);

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

export default function MintPage({ wallet, appConfig, pool, isLive, poolError }) {
  const [payloadHex, setPayloadHex] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompactMintLayout, setIsCompactMintLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1020 : false
  );

  const routerAddress = appConfig?.routerAddress || "";
  const payloadBytes = isHexString(payloadHex) ? dataLength(payloadHex) : 0;
  const payloadValid = isValidMintPayload(payloadHex);
  const mintPriceLabel = isLive && pool.mintPriceEth != null
    ? `${pool.mintPriceEth} ETH`
    : "— ETH";
  const mintedCount = Number(pool.totalMinted || 0);
  const mintedProgress = Math.min((mintedCount / MINT_TARGET_SUPPLY) * 100, 100);
  const stageLabel = isLive ? "Public mint live" : "Preview mode";
  const networkLabel = wallet?.chainId ? `Chain ${wallet.chainId}` : getTargetChainLabel(appConfig);
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
    if (!routerAddress) {
      setTxStatus("Router address not set in appConfig.");
      return;
    }
    const chainErr = checkChain(wallet, appConfig);
    if (chainErr) {
      setTxStatus(chainErr);
      return;
    }
    if (!payloadValid) {
      setTxStatus("Need a valid 512-byte payload from the Pixel Editor.");
      return;
    }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus("Awaiting wallet confirmation...");
      const signer = await wallet.provider.getSigner();
      const router = new Contract(routerAddress, PIXEL_ROUTER_ABI, signer);
      const price = await router.mintPrice();
      const tx = await router.mint(getBytes(payloadHex), { value: price });
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
    <div style={{ width: "calc(100vw - 24px)", margin: "0 auto", padding: "118px 12px 64px" }}>
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
              Every mint creates a fully on-chain pixel piece, seeds the reserve that later supports floor quotes, and routes capital into treasury and protocol support lanes.
            </div>

            <FrostCard style={{ padding: 18, background: COLORS.surfaceStrong, borderRadius: 22, marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
                    {stageLabel}
                  </div>
                    <div style={{ marginTop: 6, color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, lineHeight: 1.7 }}>
                      Router path: mint the art, seed reserve balances, and update protocol accounting in one motion.
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
              <WrongChainBanner wallet={wallet} appConfig={appConfig} />
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
            onChange={(event) => setPayloadHex(event.target.value.trim())}
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
                ["Reserve seed", "60% of each mint goes to the pool reserve and seeds the reserve-backed floor lane of the protocol."],
                ["Treasury lane", "10% is routed to treasury for buyback, stale inventory cleanup, and weak-demand inventory management."],
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
