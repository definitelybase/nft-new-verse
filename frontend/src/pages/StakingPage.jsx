import React, { useEffect, useState, useMemo } from "react";
import { Contract, formatEther } from "ethers-v6";
import { ERC721_ABI, PIXEL_POOL_ABI } from "../pixelRouterAbi";
import { MetalButton } from "../MetalButton";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { checkChain, formatEth, revealStyle, summarizeTokenIds } from "../utils/helpers";
import { DataBadge, FrostCard, MetricPanel, TokenGrid, TxStatusBar, WrongChainBanner } from "../components/ui";

const LOCK_TIERS = [
  { id: 0, label: "No lock", duration: "Flexible", multiplier: "1x", color: COLORS.textMuted },
  { id: 1, label: "7 days", duration: "7d", multiplier: "1.25x", color: COLORS.green },
  { id: 2, label: "30 days", duration: "30d", multiplier: "1.5x", color: COLORS.yellow },
  { id: 3, label: "90 days", duration: "90d", multiplier: "2x", color: COLORS.purple },
];

function LockTierSelector({ selected, onSelect, disabled }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
      {LOCK_TIERS.map((tier) => (
        <button
          key={tier.id}
          onClick={() => !disabled && onSelect(tier.id)}
          disabled={disabled}
          style={{
            padding: "10px 6px",
            borderRadius: 14,
            border: `1.5px solid ${selected === tier.id ? tier.color : COLORS.border}`,
            background: selected === tier.id ? COLORS.surfaceStrong : "transparent",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            textAlign: "center",
            transition: "all 0.15s",
          }}
        >
          <div style={{ color: tier.color, fontFamily: fontDisplay, fontSize: 16, fontWeight: 600 }}>
            {tier.multiplier}
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 10, marginTop: 4 }}>
            {tier.label}
          </div>
        </button>
      ))}
    </div>
  );
}

function TokenLockBadge({ lockTier, lockExpiry }) {
  if (!lockTier || lockTier === 0) return null;
  const tier = LOCK_TIERS[lockTier] || LOCK_TIERS[0];
  const now = Math.floor(Date.now() / 1000);
  const expired = lockExpiry && Number(lockExpiry) <= now;
  const remaining = lockExpiry ? Number(lockExpiry) - now : 0;

  let timeLeft = "";
  if (expired) {
    timeLeft = "Unlocked";
  } else if (remaining > 86400) {
    timeLeft = `${Math.ceil(remaining / 86400)}d left`;
  } else if (remaining > 3600) {
    timeLeft = `${Math.ceil(remaining / 3600)}h left`;
  } else {
    timeLeft = `${Math.ceil(remaining / 60)}m left`;
  }

  return (
    <span style={{
      display: "inline-block",
      padding: "3px 8px",
      borderRadius: 8,
      fontSize: 9,
      fontFamily: fonts,
      color: expired ? COLORS.green : tier.color,
      border: `1px solid ${expired ? COLORS.green : tier.color}`,
      opacity: 0.85,
    }}>
      {tier.multiplier} {timeLeft}
    </span>
  );
}

export default function StakingPage({ pool, isLive, wallet, appConfig, poolError }) {
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStakeTokens, setSelectedStakeTokens] = useState([]);
  const [selectedUnstakeTokens, setSelectedUnstakeTokens] = useState([]);
  const [userStaked, setUserStaked] = useState([]);
  const [ownedTokenIds, setOwnedTokenIds] = useState([]);
  const [pendingFees, setPendingFees] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [lockTier, setLockTier] = useState(0);
  const [stakingStats, setStakingStats] = useState(null);
  const [stakingInfo, setStakingInfo] = useState(null);
  const [tokenLockInfo, setTokenLockInfo] = useState({});
  const [isCompactStakingLayout, setIsCompactStakingLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1040 : false
  );

  const poolAddress = appConfig?.poolAddress || "";
  const nftAddress = appConfig?.nftAddress || "";

  // Load user staking data
  useEffect(() => {
    if (!wallet?.provider || !wallet?.account || !poolAddress) {
      setUserStaked([]);
      setPendingFees(null);
      setStakingInfo(null);
      return;
    }
    let cancelled = false;

    async function load() {
      setLoadingUser(true);
      try {
        const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, wallet.provider);
        const [staked, fees, info] = await Promise.all([
          poolContract.getUserStakedTokens(wallet.account),
          poolContract.viewPendingFees(wallet.account),
          poolContract.getStakingInfo(wallet.account).catch(() => null),
        ]);
        if (!cancelled) {
          const stakedIds = staked.map((tokenId) => Number(tokenId));
          setUserStaked(stakedIds);
          setPendingFees(fees);
          setStakingInfo(info);

          // Load lock info for each staked token
          if (stakedIds.length > 0) {
            const lockInfos = await Promise.all(
              stakedIds.map(async (id) => {
                try {
                  const tokenInfo = await poolContract.getTokenStakeInfo(id);
                  return [id, tokenInfo];
                } catch {
                  return [id, null];
                }
              })
            );
            if (!cancelled) {
              const infoMap = {};
              for (const [id, info] of lockInfos) {
                if (info) infoMap[id] = info;
              }
              setTokenLockInfo(infoMap);
            }
          }
        }
      } catch {
        if (!cancelled) {
          setUserStaked([]);
          setPendingFees(null);
          setStakingInfo(null);
        }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [wallet?.provider, wallet?.account, poolAddress, txHash]);

  // Load global staking stats
  useEffect(() => {
    if (!wallet?.provider || !poolAddress) {
      setStakingStats(null);
      return;
    }
    let cancelled = false;
    async function loadStats() {
      try {
        const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, wallet.provider);
        const stats = await poolContract.getStakingStats();
        if (!cancelled) setStakingStats(stats);
      } catch {
        if (!cancelled) setStakingStats(null);
      }
    }
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [wallet?.provider, poolAddress, txHash]);

  // Load owned tokens
  useEffect(() => {
    if (!wallet?.provider || !wallet?.account || !nftAddress) {
      setOwnedTokenIds([]);
      setSelectedStakeTokens([]);
      return;
    }

    let cancelled = false;

    async function loadOwned() {
      setLoadingOwned(true);
      try {
        const nft = new Contract(nftAddress, ERC721_ABI, wallet.provider);
        const owner = wallet.account.toLowerCase();
        const balance = Number(await nft.balanceOf(wallet.account));
        const upperBound = Number(pool?.totalMinted || 0);

        if (!balance || !upperBound) {
          if (!cancelled) {
            setOwnedTokenIds([]);
            setSelectedStakeTokens([]);
          }
          return;
        }

        const found = [];
        const batchSize = 120;

        for (let start = 0; start < upperBound && found.length < balance; start += batchSize) {
          const size = Math.min(batchSize, upperBound - start);
          const ids = Array.from({ length: size }, (_, index) => start + index);
          const matches = await Promise.all(
            ids.map(async (tokenId) => {
              try {
                const tokenOwner = await nft.ownerOf(tokenId);
                return tokenOwner.toLowerCase() === owner ? tokenId : null;
              } catch {
                return null;
              }
            })
          );
          if (cancelled) return;
          for (const tokenId of matches) {
            if (tokenId !== null) found.push(tokenId);
          }
        }

        if (!cancelled) {
          setOwnedTokenIds(found);
        }
      } catch {
        if (!cancelled) {
          setOwnedTokenIds([]);
          setSelectedStakeTokens([]);
        }
      } finally {
        if (!cancelled) setLoadingOwned(false);
      }
    }

    loadOwned();
    return () => {
      cancelled = true;
    };
  }, [wallet?.provider, wallet?.account, nftAddress, pool?.totalMinted, txHash]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function updateLayoutMode() {
      setIsCompactStakingLayout(window.innerWidth < 1040);
    }
    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  function toggleStakeSelect(tokenId) {
    setSelectedStakeTokens((prev) =>
      prev.includes(tokenId) ? prev.filter((id) => id !== tokenId) : [...prev, tokenId]
    );
  }

  function toggleUnstakeSelect(tokenId) {
    setSelectedUnstakeTokens((prev) =>
      prev.includes(tokenId) ? prev.filter((id) => id !== tokenId) : [...prev, tokenId]
    );
  }

  async function handleStake() {
    if (!wallet?.provider || !wallet?.account) {
      setTxStatus("Connect wallet first.");
      return;
    }
    if (!poolAddress || !nftAddress) {
      setTxStatus("Pool or NFT address not set.");
      return;
    }
    const chainErr = checkChain(wallet, appConfig);
    if (chainErr) { setTxStatus(chainErr); return; }

    const tokenIds = selectedStakeTokens;
    if (tokenIds.length === 0) {
      setTxStatus("Select NFTs to stake.");
      return;
    }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus("Checking approval...");
      const signer = await wallet.provider.getSigner();
      const nft = new Contract(nftAddress, ERC721_ABI, signer);
      const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const approved = await nft.isApprovedForAll(wallet.account, poolAddress);
      if (!approved) {
        setTxStatus("Approving pool to hold your NFTs...");
        const approveTx = await nft.setApprovalForAll(poolAddress, true);
        await approveTx.wait();
      }

      let tx;
      if (tokenIds.length === 1 && lockTier === 0) {
        setTxStatus(`Staking #${tokenIds[0]}. Confirm in wallet...`);
        tx = await poolContract.stake(tokenIds[0]);
      } else if (tokenIds.length === 1 && lockTier > 0) {
        setTxStatus(`Staking #${tokenIds[0]} with ${LOCK_TIERS[lockTier].label} lock...`);
        tx = await poolContract.stakeWithLock(tokenIds[0], lockTier);
      } else if (lockTier === 0) {
        setTxStatus(`Batch staking ${tokenIds.length} NFTs...`);
        tx = await poolContract.stakeBatch(tokenIds);
      } else {
        setTxStatus(`Batch staking ${tokenIds.length} NFTs with ${LOCK_TIERS[lockTier].label} lock...`);
        tx = await poolContract.stakeBatchWithLock(tokenIds, lockTier);
      }

      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus(`${tokenIds.length} NFT${tokenIds.length > 1 ? "s" : ""} staked${lockTier > 0 ? ` with ${LOCK_TIERS[lockTier].multiplier} boost` : ""}.`);
      setSelectedStakeTokens([]);
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Stake failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnstake() {
    if (!wallet?.provider || !wallet?.account) {
      setTxStatus("Connect wallet first.");
      return;
    }
    const chainErr = checkChain(wallet, appConfig);
    if (chainErr) { setTxStatus(chainErr); return; }

    const tokenIds = selectedUnstakeTokens;
    if (tokenIds.length === 0) {
      setTxStatus("Select NFTs to unstake.");
      return;
    }

    // Check for locked tokens
    const lockedTokens = tokenIds.filter((id) => {
      const info = tokenLockInfo[id];
      if (!info) return false;
      const expiry = Number(info.lockExpiry);
      return expiry > 0 && expiry > Math.floor(Date.now() / 1000);
    });
    if (lockedTokens.length > 0) {
      setTxStatus(`Token${lockedTokens.length > 1 ? "s" : ""} #${lockedTokens.join(", #")} still locked. Wait for lock to expire.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setTxHash("");

      const signer = await wallet.provider.getSigner();
      const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, signer);

      let tx;
      if (tokenIds.length === 1) {
        setTxStatus(`Unstaking #${tokenIds[0]}...`);
        tx = await poolContract.unstake(tokenIds[0]);
      } else {
        setTxStatus(`Batch unstaking ${tokenIds.length} NFTs...`);
        tx = await poolContract.unstakeBatch(tokenIds);
      }

      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus(`${tokenIds.length} NFT${tokenIds.length > 1 ? "s" : ""} unstaked. Pending fees paid out.`);
      setSelectedUnstakeTokens([]);
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Unstake failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmergencyUnstake(tokenId) {
    if (!wallet?.provider || !wallet?.account) return;
    const chainErr = checkChain(wallet, appConfig);
    if (chainErr) { setTxStatus(chainErr); return; }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus(`Emergency unstaking #${tokenId} (50% reward penalty)...`);
      const signer = await wallet.provider.getSigner();
      const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const tx = await poolContract.emergencyUnstake(tokenId);
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus(`Token #${tokenId} emergency unstaked. 50% of pending rewards forfeited.`);
      setSelectedUnstakeTokens([]);
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Emergency unstake failed. Pool must be paused.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClaim() {
    if (!wallet?.provider || !wallet?.account) {
      setTxStatus("Connect wallet first.");
      return;
    }
    const chainErr = checkChain(wallet, appConfig);
    if (chainErr) { setTxStatus(chainErr); return; }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus("Claiming fee share...");
      const signer = await wallet.provider.getSigner();
      const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const tx = await poolContract.claimFees();
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Fee share claimed.");
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Claim failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasPending = pendingFees != null && pendingFees > 0n;
  const shareLabel = stakingInfo ? `${(Number(stakingInfo.shareOfPoolBps) / 100).toFixed(1)}% of pool` : "";
  const avgMultiplier = stakingStats ? `${(Number(stakingStats.avgMultiplierBps) / 10000).toFixed(2)}x` : "";

  return (
    <div style={{ width: "calc(100vw - 24px)", margin: "0 auto", padding: "118px 12px 64px" }}>
      {/* Top metrics */}
      <div style={{ display: "grid", gridTemplateColumns: isCompactStakingLayout ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12, alignItems: "stretch" }}>
        <MetricPanel className="site-reveal-soft" style={revealStyle(80)} label="Total staked" value={pool.totalStaked ?? "—"} sub={stakingStats ? `Avg boost: ${avgMultiplier}` : "NFTs earning fee flow"} tone="purple" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(120)} label="Your staked" value={loadingUser ? "..." : userStaked.length} sub={shareLabel || summarizeTokenIds(userStaked)} tone="accent" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(160)} label="Pending fees" value={hasPending ? formatEth(pendingFees) : "0 ETH"} sub={hasPending ? `~$${(Number(formatEther(pendingFees)) * (pool.ethUsd || 2000)).toFixed(2)}` : "No fee share accrued yet"} tone="green" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(200)} label="Total distributed" value={stakingStats ? formatEth(stakingStats._totalFeesDistributed) || "0 ETH" : "—"} sub="All-time staker rewards" tone="yellow" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isCompactStakingLayout ? "1fr" : "minmax(0, 0.96fr) minmax(360px, 0.88fr)",
          gap: 14,
          marginTop: 18,
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          {/* Stake card */}
          <FrostCard className="site-reveal" style={{ padding: 24, minHeight: 380, display: "flex", flexDirection: "column", ...revealStyle(260) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Stake NFTs
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Lock your NFTs to earn protocol trade fees. Choose a lock tier for boosted rewards.
              {selectedStakeTokens.length > 0 && (
                <span style={{ color: COLORS.accent }}> {selectedStakeTokens.length} selected</span>
              )}
            </div>

            <LockTierSelector selected={lockTier} onSelect={setLockTier} disabled={isSubmitting} />

            <TokenGrid
              title="Your NFTs"
              tokens={ownedTokenIds}
              selectedTokenId={selectedStakeTokens}
              onSelect={toggleStakeSelect}
              loading={loadingOwned}
              emptyLabel={wallet?.account ? "No wallet NFTs available to stake." : "Connect wallet to load your NFTs."}
              tone="purple"
              multi
            />

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {ownedTokenIds.length > 0 && (
                <MetalButton
                  onClick={() => setSelectedStakeTokens(selectedStakeTokens.length === ownedTokenIds.length ? [] : [...ownedTokenIds])}
                  tone="ghost"
                  size="sm"
                  style={{ padding: "8px 14px" }}
                >
                  {selectedStakeTokens.length === ownedTokenIds.length ? "Deselect all" : "Select all"}
                </MetalButton>
              )}
              <MetalButton
                onClick={handleStake}
                disabled={isSubmitting || (wallet?.account ? selectedStakeTokens.length === 0 : false)}
                block
                tone="purple"
                active={wallet?.account ? selectedStakeTokens.length > 0 : true}
                size="md"
                style={{
                  flex: 1,
                  cursor: isSubmitting ? "progress" : wallet?.account ? (selectedStakeTokens.length > 0 ? "pointer" : "not-allowed") : "pointer",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Staking..." : wallet?.account
                  ? selectedStakeTokens.length > 0
                    ? `Stake ${selectedStakeTokens.length} NFT${selectedStakeTokens.length > 1 ? "s" : ""}${lockTier > 0 ? ` (${LOCK_TIERS[lockTier].multiplier})` : ""}`
                    : "Select NFTs to stake"
                  : "Stake NFTs"}
              </MetalButton>
            </div>
          </FrostCard>

          {/* Unstake card */}
          <FrostCard className="site-reveal" style={{ padding: 24, minHeight: 380, display: "flex", flexDirection: "column", ...revealStyle(300) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Unstake NFTs
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Withdraw your NFTs. Pending fee share is paid out automatically. Locked tokens must wait for expiry.
              {selectedUnstakeTokens.length > 0 && (
                <span style={{ color: COLORS.red }}> {selectedUnstakeTokens.length} selected</span>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {userStaked.length === 0 && !loadingUser && (
                <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, padding: "20px 0" }}>
                  {wallet?.account ? "No staked NFTs yet." : "Connect wallet to load staked NFTs."}
                </div>
              )}
              {loadingUser && (
                <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 11, padding: "20px 0" }}>Loading...</div>
              )}
              {userStaked.map((tokenId) => {
                const info = tokenLockInfo[tokenId];
                const isSelected = selectedUnstakeTokens.includes(tokenId);
                return (
                  <button
                    key={tokenId}
                    onClick={() => toggleUnstakeSelect(tokenId)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 14,
                      border: `1.5px solid ${isSelected ? COLORS.red : COLORS.border}`,
                      background: isSelected ? COLORS.surfaceStrong : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      minWidth: 72,
                    }}
                  >
                    <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 14, fontWeight: 600 }}>
                      #{tokenId}
                    </div>
                    {info && <TokenLockBadge lockTier={Number(info.lockTier)} lockExpiry={info.lockExpiry} />}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {userStaked.length > 0 && (
                <MetalButton
                  onClick={() => setSelectedUnstakeTokens(selectedUnstakeTokens.length === userStaked.length ? [] : [...userStaked])}
                  tone="ghost"
                  size="sm"
                  style={{ padding: "8px 14px" }}
                >
                  {selectedUnstakeTokens.length === userStaked.length ? "Deselect all" : "Select all"}
                </MetalButton>
              )}
              <MetalButton
                onClick={handleUnstake}
                disabled={isSubmitting || (wallet?.account ? selectedUnstakeTokens.length === 0 : false)}
                block
                tone="red"
                active={wallet?.account ? selectedUnstakeTokens.length > 0 : true}
                size="md"
                style={{
                  flex: 1,
                  cursor: isSubmitting ? "progress" : wallet?.account ? (selectedUnstakeTokens.length > 0 ? "pointer" : "not-allowed") : "pointer",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Unstaking..." : wallet?.account
                  ? selectedUnstakeTokens.length > 0
                    ? `Unstake ${selectedUnstakeTokens.length} NFT${selectedUnstakeTokens.length > 1 ? "s" : ""}`
                    : "Select NFTs to unstake"
                  : "Unstake NFTs"}
              </MetalButton>
            </div>
          </FrostCard>
        </div>

        {/* Right column: claim + stats */}
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <FrostCard
            className="site-reveal"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "100%",
              maxWidth: isCompactStakingLayout ? "100%" : 440,
              justifySelf: isCompactStakingLayout ? "stretch" : "end",
              ...revealStyle(200),
            }}
          >
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
              Claim fee share
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Stakers receive 10% of protocol trade fees weighted by lock multiplier. Fees accrue while trading happens and can be claimed at any time.
            </div>

            {stakingInfo && Number(stakingInfo.effectiveWeight) > 0 && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: 12, borderRadius: 14, background: COLORS.surfaceStrong }}>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Your weight</div>
                  <div style={{ color: COLORS.purple, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                    {Number(stakingInfo.effectiveWeight)}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 14, background: COLORS.surfaceStrong }}>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>Pool share</div>
                  <div style={{ color: COLORS.accent, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                    {(Number(stakingInfo.shareOfPoolBps) / 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              <MetalButton
                onClick={handleClaim}
                disabled={isSubmitting || (wallet?.account ? !hasPending : false)}
                block
                tone="green"
                active={wallet?.account ? hasPending : true}
                size="lg"
                style={{
                  width: "100%",
                  cursor: isSubmitting ? "progress" : wallet?.account ? (hasPending ? "pointer" : "not-allowed") : "pointer",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Claiming..." : wallet?.account ? (hasPending ? `Claim ${formatEth(pendingFees)}` : "No fee share accrued yet") : "Claim fee share"}
              </MetalButton>
            </div>
          </FrostCard>

          {/* Lock tiers info card */}
          <FrostCard
            className="site-reveal"
            style={{
              padding: 24,
              width: "100%",
              maxWidth: isCompactStakingLayout ? "100%" : 440,
              justifySelf: isCompactStakingLayout ? "stretch" : "end",
              ...revealStyle(340),
            }}
          >
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Lock tiers
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Lock your NFTs longer for a higher share of protocol fees. Weight determines your portion of the 10% staker fee.
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {LOCK_TIERS.map((tier) => (
                <div key={tier.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: COLORS.surfaceStrong }}>
                  <div>
                    <span style={{ color: tier.color, fontFamily: fontDisplay, fontSize: 14, fontWeight: 600 }}>{tier.multiplier}</span>
                    <span style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginLeft: 8 }}>{tier.label}</span>
                  </div>
                  <div style={{ color: COLORS.textDim, fontFamily: fonts, fontSize: 10 }}>
                    {tier.id === 0 ? "Withdraw anytime" : `Locked for ${tier.duration}`}
                  </div>
                </div>
              ))}
            </div>
          </FrostCard>

          {/* Emergency unstake (only show if user has locked tokens) */}
          {userStaked.some((id) => {
            const info = tokenLockInfo[id];
            return info && Number(info.lockTier) > 0 && Number(info.lockExpiry) > Math.floor(Date.now() / 1000);
          }) && (
            <FrostCard
              className="site-reveal"
              style={{
                padding: 24,
                width: "100%",
                maxWidth: isCompactStakingLayout ? "100%" : 440,
                justifySelf: isCompactStakingLayout ? "stretch" : "end",
                border: `1px solid ${COLORS.red}`,
                ...revealStyle(380),
              }}
            >
              <div style={{ color: COLORS.red, fontFamily: fontDisplay, fontSize: 18, fontWeight: 600 }}>
                Emergency unstake
              </div>
              <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 11, marginTop: 6, lineHeight: 1.7 }}>
                Only available when the pool is paused. Forfeits 50% of pending rewards as penalty. Use only in emergencies.
              </div>
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {userStaked
                  .filter((id) => {
                    const info = tokenLockInfo[id];
                    return info && Number(info.lockTier) > 0 && Number(info.lockExpiry) > Math.floor(Date.now() / 1000);
                  })
                  .map((tokenId) => (
                    <MetalButton
                      key={tokenId}
                      onClick={() => handleEmergencyUnstake(tokenId)}
                      disabled={isSubmitting}
                      tone="red"
                      size="sm"
                      style={{ padding: "8px 14px" }}
                    >
                      #{tokenId}
                    </MetalButton>
                  ))}
              </div>
            </FrostCard>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <TxStatusBar txStatus={txStatus} txHash={txHash} chainId={wallet?.chainId} />
        <div style={{ marginTop: 8 }}>
          <DataBadge isLive={isLive} error={poolError} />
        </div>
      </div>
    </div>
  );
}
