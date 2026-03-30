import { ZeroAddress, dataLength, formatEther, getAddress, isHexString } from "ethers-v6";
import { CHAIN_LABELS, MINT_PAYLOAD_STORAGE_KEY, MOCK_POOL } from "./constants";

export function shortAddress(value) {
  if (!value) return "Connect wallet";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatEth(value, digits = 4) {
  if (value == null) return null;
  try {
    return `${Number(formatEther(value)).toFixed(digits)} ETH`;
  } catch {
    return null;
  }
}

export function summarizeTokenIds(ids) {
  if (!ids?.length) return "None staked";
  const preview = ids.slice(0, 4).join(", ");
  return ids.length <= 4 ? `IDs: ${preview}` : `${preview} +${ids.length - 4}`;
}

export function readStoredMintPayload() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(MINT_PAYLOAD_STORAGE_KEY) || "";
}

export function isValidMintPayload(payloadHex) {
  if (!payloadHex || !isHexString(payloadHex)) return false;
  return dataLength(payloadHex) === 128;
}

export function revealStyle(delay = 0) {
  return { animationDelay: `${delay}ms` };
}

export function driftStyle(delay = 0, duration = 8) {
  return {
    animationDelay: `${delay}ms`,
    animationDuration: `${duration}s`,
  };
}

export function explorerTxUrl(txHash, chainId) {
  const explorers = {
    "1": "https://etherscan.io",
    "11155111": "https://sepolia.etherscan.io",
    "8453": "https://basescan.org",
    "84532": "https://sepolia.basescan.org",
  };
  const base = explorers[chainId];
  return base ? `${base}/tx/${txHash}` : null;
}

export function fmtEth(val, digits = 5) {
  if (val == null) return "—";
  return `${Number(val).toFixed(digits)} ETH`;
}

export function fmtPct(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)}%`;
}

export function getTargetChainId(appConfig) {
  return String(appConfig?.chainId || "11155111");
}

export function getTargetChainLabel(appConfig) {
  const targetChainId = getTargetChainId(appConfig);
  return CHAIN_LABELS[targetChainId] || `Chain ${targetChainId}`;
}

export function checkChain(wallet, appConfig) {
  const targetChainId = getTargetChainId(appConfig);
  if (wallet?.chainId && wallet.chainId !== targetChainId) {
    return `Wrong network (chainId ${wallet.chainId}). Switch to ${getTargetChainLabel(appConfig)}.`;
  }
  return null;
}

export function isZeroAddress(value) {
  try {
    return getAddress(value) === ZeroAddress;
  } catch {
    return false;
  }
}

export function buildPoolView(liveData) {
  if (!liveData) return MOCK_POOL;
  return {
    ethBalance: liveData.ethBalance,
    floor: liveData.floor,
    sellPrice: liveData.sellPrice,
    sellPayout: liveData.sellPayout,
    listingPrice: liveData.listingPrice,
    totalMinted: liveData.totalMinted,
    totalStaked: liveData.lockedSupply,
    poolNfts: liveData.poolNfts,
    circulating: liveData.circulatingSupply,
    emc: liveData.emc,
    liqRatio: liveData.liqRatio,
    protocolFees: liveData.protocolFees,
    treasuryBalance: liveData.treasuryBalance,
    marketState: liveData.marketState,
    canSell: liveData.canSell,
    listingEnabled: liveData.listingEnabled,
    ethUsd: liveData.ethUsd,
    mintPriceEth: liveData.mintPriceEth,
    dailyVolume: null,
    trades24h: null,
  };
}
