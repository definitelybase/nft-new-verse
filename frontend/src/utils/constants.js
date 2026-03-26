export const COLORS = {
  bg: "var(--ocp-bg)",
  surface: "var(--ocp-surface)",
  surfaceStrong: "var(--ocp-surface-strong)",
  border: "var(--ocp-border)",
  borderStrong: "var(--ocp-border-strong)",
  text: "var(--ocp-text)",
  textMuted: "var(--ocp-text-muted)",
  textDim: "var(--ocp-text-dim)",
  accent: "var(--ocp-accent)",
  accentSoft: "var(--ocp-accent-soft)",
  green: "var(--ocp-green)",
  greenSoft: "var(--ocp-green-soft)",
  yellow: "var(--ocp-yellow)",
  yellowSoft: "var(--ocp-yellow-soft)",
  purple: "var(--ocp-purple)",
  purpleSoft: "var(--ocp-purple-soft)",
  red: "var(--ocp-red)",
  redSoft: "var(--ocp-red-soft)",
};

export const fonts = `'IBM Plex Mono', 'JetBrains Mono', monospace`;
export const fontDisplay = `'Space Grotesk', 'Satoshi', 'Syne', sans-serif`;
export const MINT_PAYLOAD_STORAGE_KEY = "onchainpixel.mintPayload";
export const MINT_TARGET_SUPPLY = 10000;
export const DEFAULT_PREVIEW_PALETTE = [
  "#000000", "#ffffff", "#ff0000", "#00ff00",
  "#0066ff", "#ffcc00", "#ff6600", "#9933ff",
  "#00cccc", "#ff3399", "#336633", "#663300",
  "#cccccc", "#666666", "#ffccaa", "#3399ff",
];

export const MOCK_POOL = {
  ethBalance: 0,
  floor: 0,
  sellPrice: 0,
  sellPayout: 0,
  listingPrice: 0,
  totalMinted: 0,
  totalStaked: 0,
  poolNfts: 0,
  circulating: 0,
  emc: 0,
  liqRatio: 0,
  protocolFees: 0,
  treasuryBalance: 0,
  marketState: null,
  canSell: false,
  listingEnabled: false,
  ethUsd: 2000,
  mintPriceEth: null,
  dailyVolume: null,
  trades24h: null,
};

export const CHAIN_LABELS = {
  "1": "Ethereum",
  "11155111": "Sepolia",
  "84532": "Base Sepolia",
  "31337": "Hardhat",
};
