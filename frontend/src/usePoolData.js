import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { PIXEL_POOL_ABI, PIXEL_ROUTER_ABI } from "./pixelRouterAbi";

const MARKET_STATES = ["Expansion", "Stabilization", "WeakDemand"];
const POLL_INTERVAL = 15_000; // 15s

function fmt(bn, decimals = 18) {
  return Number(ethers.utils.formatUnits(bn, decimals));
}

function fmtFeeAdjusted(bn, feeBps, direction) {
  const fee = bn.mul(feeBps).div(10000);
  const adjusted = direction === "subtract" ? bn.sub(fee) : bn.add(fee);
  return Number(ethers.utils.formatUnits(adjusted, 18));
}

/**
 * Reads live pool + router state. Returns null while loading.
 * Falls back to rpcUrl if no wallet provider is available.
 */
export default function usePoolData({ poolAddress, routerAddress, rpcUrl, ethUsd, walletProvider }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!poolAddress) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let provider = walletProvider || null;
    if (!provider && rpcUrl) {
      try {
        provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      } catch {
        setData(null);
        setError("Invalid rpcUrl.");
        setLoading(false);
        return;
      }
    }

    if (!provider) {
      setData(null);
      setError("No provider available. Connect wallet or set rpcUrl.");
      setLoading(false);
      return;
    }

    try {
      const pool = new ethers.Contract(poolAddress, PIXEL_POOL_ABI, provider);
      const hasRouter = Boolean(routerAddress);
      const router = hasRouter
        ? new ethers.Contract(routerAddress, PIXEL_ROUTER_ABI, provider)
        : null;

      // Pool reads always work; router reads are optional
      const poolReads = [
        pool.getMarketMetrics(),
        pool.marketState(),
        pool.treasuryBalance(),
        pool.protocolFees(),
        pool.totalMinted(),
        pool.totalBurned(),
      ];

      const routerReads = router
        ? [router.getPrices(), router.getPoolState(), router.mintPrice()]
        : [null, null, null];

      const [
        metrics,
        state,
        treasuryBal,
        protocolFees,
        totalMintedRaw,
        totalBurnedRaw,
        prices,
        poolState,
        mintPrice,
      ] = await Promise.all([...poolReads, ...routerReads]);

      const ethUsdNum = Number(ethUsd) || 2000;
      const floor = fmt(metrics.effectiveFloor);
      const poolETH = fmt(metrics.poolETH);
      const emc = fmt(metrics.effectiveMarketCap);
      const liqRatio = Number(metrics.liquidityRatio) / 100; // BPS → %
      const sellPrice = prices ? fmt(prices.sellPrice) : 0;
      const buyPrice = prices ? fmt(prices.buyPrice) : 0;
      const sellPayout = prices ? fmtFeeAdjusted(prices.sellPrice, 250, "subtract") : 0;
      const buyCost = prices ? fmtFeeAdjusted(prices.buyPrice, 250, "add") : 0;

      setData({
        // prices (pool-only fallback when router is absent)
        floor,
        sellPrice,
        sellPayout,
        buyPrice,
        buyCost,
        floorUsd: floor * ethUsdNum,

        // supply
        totalMinted: Number(totalMintedRaw),
        totalBurned: Number(totalBurnedRaw),
        circulatingSupply: Number(metrics.circulatingSupply),
        lockedSupply: Number(metrics.lockedSupply),
        poolNfts: Number(metrics.poolSupply),
        available: prices ? Number(prices.available) : Number(metrics.poolSupply),

        // pool
        ethBalance: poolETH,
        ethBalanceUsd: poolETH * ethUsdNum,
        treasuryBalance: fmt(treasuryBal),
        protocolFees: fmt(protocolFees),
        emc,
        emcUsd: emc * ethUsdNum,
        liqRatio,

        // market state
        marketState: MARKET_STATES[state] || "Unknown",
        marketStateIdx: state,
        canSell: poolState ? poolState.poolBuysEnabled : false,
        canBuy: poolState ? poolState.poolSellsEnabled : false,
        volumeRatioBps: poolState ? Number(poolState.volumeRatioBps) : 0,
        pressureRatioBps: poolState ? Number(poolState.pressureRatioBps) : 0,
        floorDeviationBps: poolState ? Number(poolState.floorDeviationBps) : 0,
        coverageRatioBps: poolState ? Number(poolState.coverageRatioBps) : 0,

        // mint
        mintPrice: mintPrice || null,
        mintPriceEth: mintPrice ? fmt(mintPrice) : null,

        // meta
        hasRouter: Boolean(router),
        ethUsd: ethUsdNum,
        updatedAt: Date.now(),
      });

      setError(null);
    } catch (err) {
      setData(null);
      setError(err.message || "Failed to read pool data.");
    } finally {
      setLoading(false);
    }
  }, [poolAddress, routerAddress, rpcUrl, ethUsd, walletProvider]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, error, loading, refetch: fetchData };
}
