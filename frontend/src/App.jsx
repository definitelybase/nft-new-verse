import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserProvider } from "ethers-v6";
import { APP_CONFIG } from "./appConfig";
import { MetalButton } from "./MetalButton";
import { ThemeModeProvider } from "./ThemeModeContext";

const OnchainPixelSite = lazy(() => import("./OnchainPixelSite"));
const OnchainPixelEditor = lazy(() => import("./OnchainPixelEditor"));
const GLSLHills = lazy(() =>
  import("./GLSLHills").then((module) => ({ default: module.GLSLHills }))
);

const SHELL_COLORS = {
  bg: "var(--shell-bg)",
  card: "var(--shell-card)",
  border: "var(--shell-border)",
  borderStrong: "var(--shell-border-strong)",
  text: "var(--shell-text)",
  accent: "var(--shell-accent)",
  muted: "var(--shell-muted)",
};

const THEME_STORAGE_KEY = "onchainpixel.themeMode";

const THEME_VARS = {
  dark: {
    "--shell-bg": "radial-gradient(circle at top left, rgba(95, 83, 138, 0.14), transparent 22%), radial-gradient(circle at top right, rgba(74, 82, 118, 0.10), transparent 22%), linear-gradient(180deg, #111319 0%, #0b0d12 44%, #06070a 100%)",
    "--shell-card": "rgba(19, 22, 29, 0.72)",
    "--shell-border": "rgba(255, 255, 255, 0.08)",
    "--shell-border-strong": "rgba(255, 255, 255, 0.14)",
    "--shell-text": "#ECECF2",
    "--shell-accent": "#F4F4F8",
    "--shell-muted": "#969BAB",
    "--ocp-bg": "#07070B",
    "--ocp-surface": "rgba(16, 18, 24, 0.54)",
    "--ocp-surface-strong": "rgba(23, 26, 33, 0.72)",
    "--ocp-border": "rgba(255, 255, 255, 0.08)",
    "--ocp-border-strong": "rgba(255, 255, 255, 0.14)",
    "--ocp-text": "#F4F4F8",
    "--ocp-text-muted": "#A7ACB9",
    "--ocp-text-dim": "#757A89",
    "--ocp-accent": "#D9DDE8",
    "--ocp-accent-soft": "rgba(217, 221, 232, 0.08)",
    "--ocp-green": "#6EE7B7",
    "--ocp-green-soft": "rgba(110, 231, 183, 0.14)",
    "--ocp-yellow": "#F4CF66",
    "--ocp-yellow-soft": "rgba(244, 207, 102, 0.14)",
    "--ocp-purple": "#BA9CFF",
    "--ocp-purple-soft": "rgba(186, 156, 255, 0.14)",
    "--ocp-red": "#FF8AA1",
    "--ocp-red-soft": "rgba(255, 138, 161, 0.18)",
    "--editor-bg": "#08090d",
    "--editor-text": "#e0e0e0",
    "--editor-text-dim": "#616776",
    "--editor-text-muted": "#858b9a",
    "--editor-text-soft": "#a2a8b7",
    "--editor-text-faint": "#4e5565",
    "--editor-panel": "rgba(14,16,22,0.82)",
    "--editor-border": "rgba(255,255,255,0.08)",
    "--editor-border-strong": "rgba(255,255,255,0.12)",
    "--editor-border-soft": "rgba(255,255,255,0.16)",
    "--editor-button": "rgba(20,22,30,0.9)",
    "--editor-button-active": "rgba(0,255,136,0.20)",
    "--editor-accent": "#00ff88",
    "--editor-accent-glow": "rgba(0,255,136,0.28)",
    "--editor-preview-bg": "rgba(10,11,17,0.94)",
    "--editor-code": "#9966ff",
    "--editor-gold": "#ffcc00",
    "--editor-title-gradient": "linear-gradient(135deg, #00ff88 0%, #00ccff 50%, #9966ff 100%)",
  },
  light: {
    "--shell-bg": "radial-gradient(circle at top left, rgba(167, 145, 214, 0.16), transparent 24%), radial-gradient(circle at top right, rgba(154, 166, 214, 0.14), transparent 24%), linear-gradient(180deg, #f1f1f6 0%, #e5e7ef 48%, #d9dce7 100%)",
    "--shell-card": "rgba(251, 252, 255, 0.62)",
    "--shell-border": "rgba(54, 61, 80, 0.12)",
    "--shell-border-strong": "rgba(54, 61, 80, 0.18)",
    "--shell-text": "#161A22",
    "--shell-accent": "#202634",
    "--shell-muted": "#6E7687",
    "--ocp-bg": "#f3f4f8",
    "--ocp-surface": "rgba(250, 251, 255, 0.44)",
    "--ocp-surface-strong": "rgba(255, 255, 255, 0.62)",
    "--ocp-border": "rgba(42, 51, 68, 0.10)",
    "--ocp-border-strong": "rgba(42, 51, 68, 0.18)",
    "--ocp-text": "#151A22",
    "--ocp-text-muted": "#5C6476",
    "--ocp-text-dim": "#7D8494",
    "--ocp-accent": "#2A3140",
    "--ocp-accent-soft": "rgba(42, 49, 64, 0.08)",
    "--ocp-green": "#1A9B67",
    "--ocp-green-soft": "rgba(26, 155, 103, 0.14)",
    "--ocp-yellow": "#B78A1F",
    "--ocp-yellow-soft": "rgba(183, 138, 31, 0.12)",
    "--ocp-purple": "#7C56D8",
    "--ocp-purple-soft": "rgba(124, 86, 216, 0.12)",
    "--ocp-red": "#D25872",
    "--ocp-red-soft": "rgba(210, 88, 114, 0.12)",
    "--editor-bg": "#f3f4f8",
    "--editor-text": "#1d2330",
    "--editor-text-dim": "#758095",
    "--editor-text-muted": "#5e6678",
    "--editor-text-soft": "#42495b",
    "--editor-text-faint": "#8c93a3",
    "--editor-panel": "rgba(255,255,255,0.72)",
    "--editor-border": "rgba(49,59,79,0.10)",
    "--editor-border-strong": "rgba(49,59,79,0.16)",
    "--editor-border-soft": "rgba(49,59,79,0.18)",
    "--editor-button": "rgba(240,242,247,0.96)",
    "--editor-button-active": "rgba(26,155,103,0.14)",
    "--editor-accent": "#1A9B67",
    "--editor-accent-glow": "rgba(26,155,103,0.18)",
    "--editor-preview-bg": "rgba(245,246,251,0.96)",
    "--editor-code": "#6B52B7",
    "--editor-gold": "#B78A1F",
    "--editor-title-gradient": "linear-gradient(135deg, #1A9B67 0%, #4C72D8 52%, #7C56D8 100%)",
  },
};

function getInitialThemeMode() {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}

function getInitialAnimatedBackgroundMode() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return false;
  if (window.matchMedia?.("(max-width: 960px)")?.matches) return false;

  const memory = Number(window.navigator?.deviceMemory || 0);
  const cores = Number(window.navigator?.hardwareConcurrency || 0);

  // Default to static on normal laptops; only enable on clearly stronger devices.
  return memory >= 12 || cores >= 12;
}

const VIEWS = {
  protocol: "protocol",
  editor: "editor",
};

function ViewLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: SHELL_COLORS.muted,
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
        fontSize: 12,
        letterSpacing: 0.6,
        textTransform: "uppercase",
      }}
    >
      Loading view...
    </div>
  );
}

function BottomDockSwitch({ view, onSwitch }) {
  const items = [
    { id: VIEWS.protocol, label: "Protocol UI" },
    { id: VIEWS.editor, label: "Pixel Editor" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        zIndex: 1000,
        width: "min(360px, calc(100vw - 32px))",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: 7,
          borderRadius: 999,
          border: `1px solid ${SHELL_COLORS.border}`,
          background: SHELL_COLORS.card,
          boxShadow: "0 10px 24px rgba(0, 0, 0, 0.16)",
          backdropFilter: "blur(5px)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 7,
            bottom: 7,
            left: view === VIEWS.protocol ? 7 : "calc(50% + 3px)",
            width: "calc(50% - 10px)",
            borderRadius: 999,
            border: `1px solid ${SHELL_COLORS.borderStrong}`,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 32%, rgba(0,0,0,0.12) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 6px 16px rgba(0,0,0,0.12)",
            transition: "left 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
          }}
        >
          {items.map((item) => (
            <MetalButton
              key={item.id}
              tone="ghost"
              active={view === item.id}
              hoverLift={false}
              onClick={() => onSwitch(item.id)}
              style={{
                width: "100%",
                minHeight: 42,
                padding: "10px 12px",
                background: "transparent",
                border: "1px solid transparent",
                boxShadow: "none",
              }}
            >
              {item.label}
            </MetalButton>
          ))}
        </div>
      </div>
    </div>
  );
}

function getChainName(chainId) {
  const normalized = Number(chainId);
  const names = {
    1: "Ethereum",
    8453: "Unsupported (Base)",
    84532: "Unsupported (Base Sepolia)",
    11155111: "Sepolia",
    31337: "Hardhat",
  };
  return names[normalized] || `Chain ${normalized}`;
}

function getViewFromHash() {
  if (typeof window === "undefined") return VIEWS.protocol;
  return window.location.hash === "#editor" ? VIEWS.editor : VIEWS.protocol;
}

function useWalletStatus() {
  const [wallet, setWallet] = useState({
    hasProvider: false,
    provider: null,
    account: "",
    chainId: "",
    chainName: "No wallet",
    status: "checking",
    error: "",
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      setWallet({
        hasProvider: false,
        provider: null,
        account: "",
        chainId: "",
        chainName: "No wallet",
        status: "no_provider",
        error: "",
      });
      return undefined;
    }

    const provider = new BrowserProvider(window.ethereum);

    async function syncWallet(nextAccounts) {
      try {
        const accounts = nextAccounts || (await provider.send("eth_accounts", []));
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        setWallet({
          hasProvider: true,
          provider,
          account: accounts[0] || "",
          chainId: String(chainId),
          chainName: getChainName(chainId),
          status: accounts[0] ? "connected" : "available",
          error: "",
        });
      } catch (error) {
        setWallet({
          hasProvider: true,
          provider,
          account: "",
          chainId: "",
          chainName: "Wallet error",
          status: "error",
          error: error.message,
        });
      }
    }

    function handleAccountsChanged(accounts) {
      syncWallet(accounts);
    }

    function handleChainChanged() {
      syncWallet();
    }

    syncWallet();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!window.ethereum?.removeListener) return;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  async function connectWallet() {
    if (typeof window === "undefined" || !window.ethereum) return;
    const provider = new BrowserProvider(window.ethereum);
    try {
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      setWallet({
        hasProvider: true,
        provider,
        account: accounts[0] || "",
        chainId: String(chainId),
        chainName: getChainName(chainId),
        status: accounts[0] ? "connected" : "available",
        error: "",
      });
    } catch (error) {
      setWallet((current) => ({
        ...current,
        status: "error",
        error: error.message,
      }));
    }
  }

  return { wallet, connectWallet };
}

export default function App() {
  const [view, setView] = useState(getViewFromHash);
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const [showAnimatedBackground] = useState(getInitialAnimatedBackgroundMode);
  const { wallet, connectWallet } = useWalletStatus();
  const appConfig = APP_CONFIG;

  useEffect(() => {
    const onHashChange = () => {
      setView(getViewFromHash());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  function switchView(nextView) {
    setView(nextView);
    window.location.hash = nextView === VIEWS.editor ? "editor" : "";
  }

  function toggleTheme() {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeModeProvider value={themeMode}>
      <div
        style={{
          minHeight: "100vh",
          background: SHELL_COLORS.bg,
          position: "relative",
          overflow: "hidden",
          ...THEME_VARS[themeMode],
        }}
      >
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            opacity: themeMode === "light" ? 0.12 : 0.18,
          }}
        >
          {showAnimatedBackground ? (
            <Suspense fallback={null}>
              <GLSLHills width="100%" height="100%" cameraZ={132} planeSize={80} speed={0.12} themeMode={themeMode} />
            </Suspense>
          ) : null}
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <BottomDockSwitch view={view} onSwitch={switchView} />

          <Suspense fallback={<ViewLoader />}>
            {view === VIEWS.protocol ? (
              <OnchainPixelSite
                appConfig={appConfig}
                wallet={wallet}
                onConnectWallet={connectWallet}
                themeMode={themeMode}
                onToggleTheme={toggleTheme}
              />
            ) : (
              <OnchainPixelEditor
                appConfig={appConfig}
                wallet={wallet}
                onConnectWallet={connectWallet}
                themeMode={themeMode}
                onToggleTheme={toggleTheme}
              />
            )}
          </Suspense>
        </div>
      </div>
    </ThemeModeProvider>
  );
}
