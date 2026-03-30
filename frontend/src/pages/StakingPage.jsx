import React, { useEffect, useState } from "react";
import { Contract, formatEther } from "ethers-v6";
import { ERC721_ABI, PIXEL_POOL_ABI } from "../pixelRouterAbi";
import { MetalButton } from "../MetalButton";
import { COLORS, fonts, fontDisplay } from "../utils/constants";
import { checkChain, formatEth, revealStyle, summarizeTokenIds } from "../utils/helpers";
import { DataBadge, FrostCard, MetricPanel, TokenGrid, TxStatusBar, WrongChainBanner } from "../components/ui";

export default function StakingPage({ pool, isLive, wallet, appConfig, poolError }) {
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStakeTokenId, setSelectedStakeTokenId] = useState(null);
  const [selectedUnstakeTokenId, setSelectedUnstakeTokenId] = useState(null);
  const [userStaked, setUserStaked] = useState([]);
  const [ownedTokenIds, setOwnedTokenIds] = useState([]);
  const [pendingFees, setPendingFees] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [isCompactStakingLayout, setIsCompactStakingLayout] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1040 : false
  );

  const poolAddress = appConfig?.poolAddress || "";
  const nftAddress = appConfig?.nftAddress || "";

  useEffect(() => {
    if (!wallet?.provider || !wallet?.account || !poolAddress) {
      setUserStaked([]);
      setPendingFees(null);
      return;
    }
    let cancelled = false;

    async function load() {
      setLoadingUser(true);
      try {
        const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, wallet.provider);
        const [staked, fees] = await Promise.all([
          poolContract.getUserStakedTokens(wallet.account),
          poolContract.viewPendingFees(wallet.account),
        ]);
        if (!cancelled) {
          setUserStaked(staked.map((tokenId) => Number(tokenId)));
          setPendingFees(fees);
        }
      } catch {
        if (!cancelled) {
          setUserStaked([]);
          setPendingFees(null);
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

  useEffect(() => {
    if (!wallet?.provider || !wallet?.account || !nftAddress) {
      setOwnedTokenIds([]);
      setSelectedStakeTokenId(null);
      return;
    }

    let cancelled = false;

    async function loadOwned() {
      setLoadingOwned(true);
      try {
        const nft = new Contract(nftAddress, ERC721_ABI, wallet.provider);
        const owner = wallet.account.toLowerCase();
        const balance = Number(await nft.balanceOf(wallet.account));
        const upperBound = Math.min(Number(pool?.totalMinted || 0), 10000);

        if (!balance || !upperBound) {
          if (!cancelled) {
            setOwnedTokenIds([]);
            setSelectedStakeTokenId(null);
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
          setSelectedStakeTokenId((current) => (current != null && found.includes(current) ? current : found[0] ?? null));
        }
      } catch {
        if (!cancelled) {
          setOwnedTokenIds([]);
          setSelectedStakeTokenId(null);
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
    setSelectedUnstakeTokenId((current) =>
      current != null && userStaked.includes(current) ? current : userStaked[0] ?? null
    );
  }, [userStaked]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function updateLayoutMode() {
      setIsCompactStakingLayout(window.innerWidth < 1040);
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

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
    if (chainErr) {
      setTxStatus(chainErr);
      return;
    }

    const tokenId = selectedStakeTokenId;
    if (tokenId == null) {
      setTxStatus("Choose an NFT to stake.");
      return;
    }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus("Checking ownership...");
      const signer = await wallet.provider.getSigner();
      const nft = new Contract(nftAddress, ERC721_ABI, signer);
      const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const owner = await nft.ownerOf(tokenId);
      if (owner.toLowerCase() !== wallet.account.toLowerCase()) {
        setTxStatus(`You don't own token #${tokenId}.`);
        setIsSubmitting(false);
        return;
      }

      const approved = await nft.isApprovedForAll(wallet.account, poolAddress);
      if (!approved) {
        setTxStatus("Approving pool to hold your NFT...");
        const approveTx = await nft.setApprovalForAll(poolAddress, true);
        await approveTx.wait();
      }

      setTxStatus("Staking. Confirm in wallet...");
      const tx = await poolContract.stake(tokenId);
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus(`Token #${tokenId} staked.`);
      setSelectedStakeTokenId(null);
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Stake failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnstake(tokenId) {
    if (!wallet?.provider || !wallet?.account) {
      setTxStatus("Connect wallet first.");
      return;
    }
    const chainErr = checkChain(wallet, appConfig);
    if (chainErr) {
      setTxStatus(chainErr);
      return;
    }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus(`Unstaking token #${tokenId}...`);
      const signer = await wallet.provider.getSigner();
      const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const tx = await poolContract.unstake(tokenId);
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus(`Token #${tokenId} unstaked. Pending fees paid out automatically.`);
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Unstake failed.");
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
    if (chainErr) {
      setTxStatus(chainErr);
      return;
    }

    try {
      setIsSubmitting(true);
      setTxHash("");
      setTxStatus("Claiming fees...");
      const signer = await wallet.provider.getSigner();
      const poolContract = new Contract(poolAddress, PIXEL_POOL_ABI, signer);

      const tx = await poolContract.claimFees();
      setTxHash(tx.hash);
      setTxStatus("Submitted. Waiting for confirmation...");
      await tx.wait();
      setTxStatus("Fees claimed.");
    } catch (error) {
      setTxStatus(error?.reason || error?.data?.message || error?.message || "Claim failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasPending = pendingFees != null && pendingFees > 0n;

  return (
    <div style={{ width: "calc(100vw - 24px)", margin: "0 auto", padding: "118px 12px 64px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "stretch" }}>
        <MetricPanel className="site-reveal-soft" style={revealStyle(80)} label="Total staked" value={pool.totalStaked ?? "—"} sub="NFTs accruing fee share" tone="purple" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(120)} label="Your staked" value={loadingUser ? "..." : userStaked.length} sub={summarizeTokenIds(userStaked)} tone="accent" />
        <MetricPanel className="site-reveal-soft" style={revealStyle(160)} label="Pending fees" value={hasPending ? formatEth(pendingFees) : "0 ETH"} sub={hasPending ? `~$${(Number(formatEther(pendingFees)) * (pool.ethUsd || 2000)).toFixed(2)}` : "Nothing accrued yet"} tone="green" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isCompactStakingLayout
            ? "1fr"
            : "minmax(0, 0.96fr) minmax(360px, 0.88fr)",
          gap: 14,
          marginTop: 18,
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <FrostCard className="site-reveal" style={{ padding: 24, minHeight: 380, display: "flex", flexDirection: "column", ...revealStyle(260) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Stake NFT
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Lock your NFT in the pool to accrue a share of protocol trade fees while it remains staked.
            </div>
            <TokenGrid
              title="Your NFTs"
              tokens={ownedTokenIds}
              selectedTokenId={selectedStakeTokenId}
              onSelect={setSelectedStakeTokenId}
              loading={loadingOwned}
              emptyLabel={wallet?.account ? "No wallet NFTs available to stake." : "Connect wallet to load your NFTs."}
              tone="purple"
            />
            <MetalButton
              onClick={handleStake}
              disabled={isSubmitting || (wallet?.account ? selectedStakeTokenId == null : false)}
              block
              tone="purple"
              active={wallet?.account ? selectedStakeTokenId != null : true}
              size="md"
              style={{
                width: "100%",
                marginTop: 14,
                cursor: isSubmitting ? "progress" : wallet?.account ? (selectedStakeTokenId != null ? "pointer" : "not-allowed") : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Staking..." : wallet?.account ? (selectedStakeTokenId != null ? `Stake #${selectedStakeTokenId}` : "Select NFT to stake") : "Stake NFT"}
            </MetalButton>
          </FrostCard>

          <FrostCard className="site-reveal" style={{ padding: 24, minHeight: 380, display: "flex", flexDirection: "column", ...revealStyle(300) }}>
            <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 20, fontWeight: 600 }}>
              Unstake NFT
            </div>
            <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
              Withdraw your NFT. Pending fees are paid out automatically.
            </div>

            <TokenGrid
              title="Staked NFTs"
              tokens={userStaked}
              selectedTokenId={selectedUnstakeTokenId}
              onSelect={setSelectedUnstakeTokenId}
              loading={loadingUser}
              emptyLabel={wallet?.account ? "No staked NFTs yet." : "Connect wallet to load staked NFTs."}
              tone="red"
            />
            <MetalButton
              onClick={() => {
                if (selectedUnstakeTokenId == null) {
                  setTxStatus(wallet?.account ? "Choose an NFT to unstake." : "Connect wallet first.");
                  return;
                }
                handleUnstake(selectedUnstakeTokenId);
              }}
              disabled={isSubmitting || (wallet?.account ? selectedUnstakeTokenId == null : false)}
              block
              tone="red"
              active={wallet?.account ? selectedUnstakeTokenId != null : true}
              size="md"
              style={{
                width: "100%",
                marginTop: 14,
                cursor: isSubmitting ? "progress" : wallet?.account ? (selectedUnstakeTokenId != null ? "pointer" : "not-allowed") : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Unstaking..." : wallet?.account ? (selectedUnstakeTokenId != null ? `Unstake #${selectedUnstakeTokenId}` : "Select NFT to unstake") : "Unstake NFT"}
            </MetalButton>
          </FrostCard>
        </div>

        <FrostCard
          className="site-reveal"
          style={{
            aspectRatio: isCompactStakingLayout ? undefined : "1 / 1",
            minHeight: isCompactStakingLayout ? 320 : 360,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            justifySelf: isCompactStakingLayout ? "stretch" : "end",
            width: "100%",
            maxWidth: isCompactStakingLayout ? "100%" : 440,
            ...revealStyle(200),
          }}
        >
          <div style={{ color: COLORS.text, fontFamily: fontDisplay, fontSize: 24, fontWeight: 600 }}>
            Claim fee share
          </div>
          <div style={{ color: COLORS.textMuted, fontFamily: fonts, fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
            Stakers receive 10% of the protocol trade fee from both sides of the market. Fees accrue only when trading happens and can be claimed at any time. Unstaking also pays out pending fees.
          </div>

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
                marginTop: "auto",
                cursor: isSubmitting ? "progress" : wallet?.account ? (hasPending ? "pointer" : "not-allowed") : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Claiming..." : wallet?.account ? (hasPending ? `Claim ${formatEth(pendingFees)}` : "Nothing accrued yet") : "Claim fee share"}
            </MetalButton>
          </div>
        </FrostCard>
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
