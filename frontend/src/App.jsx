import React, { Suspense, lazy, useEffect, useState } from "react";
import { ethers } from "ethers";
import { APP_CONFIG } from "./appConfig";

const OnchainPixelSite = lazy(() => import("./OnchainPixelSite"));
const OnchainPixelEditor = lazy(() => import("./OnchainPixelEditor"));

const SHELL_COLORS = {
  bg: "radial-gradient(circle at top left, rgba(147, 121, 196, 0.24), transparent 28%), radial-gradient(circle at top right, rgba(124, 111, 154, 0.18), transparent 26%), linear-gradient(180deg, #3a3446 0%, #2a2632 42%, #1c1d24 100%)",
  card: "rgba(45, 48, 56, 0.92)",
  border: "rgba(255, 255, 255, 0.11)",
  text: "#E8E8F0",
  accent: "#F4F4F8",
  muted: "#A5A8B6",
};

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

    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");

    async function syncWallet(nextAccounts) {
      try {
        const accounts = nextAccounts || (await provider.send("eth_accounts", []));
        const network = await provider.getNetwork();
        setWallet({
          hasProvider: true,
          provider,
          account: accounts[0] || "",
          chainId: String(network.chainId),
          chainName: getChainName(network.chainId),
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
    const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    try {
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setWallet({
        hasProvider: true,
        provider,
        account: accounts[0] || "",
        chainId: String(network.chainId),
        chainName: getChainName(network.chainId),
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
  const { wallet, connectWallet } = useWalletStatus();
  const appConfig = APP_CONFIG;

  useEffect(() => {
    const onHashChange = () => {
      setView(getViewFromHash());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function switchView(nextView) {
    setView(nextView);
    window.location.hash = nextView === VIEWS.editor ? "editor" : "";
  }

  return (
    <div style={{ minHeight: "100vh", background: SHELL_COLORS.bg }}>
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 18,
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 7,
          borderRadius: 999,
          border: `1px solid ${SHELL_COLORS.border}`,
          background: SHELL_COLORS.card,
          backdropFilter: "blur(14px)",
          boxShadow: "0 16px 42px rgba(0, 0, 0, 0.22)",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        {[
          { id: VIEWS.protocol, label: "Protocol UI" },
          { id: VIEWS.editor, label: "Pixel Editor" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => switchView(item.id)}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 999,
              padding: "10px 14px",
              fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              background: view === item.id ? "rgba(255,255,255,0.08)" : "transparent",
              color: view === item.id ? SHELL_COLORS.accent : SHELL_COLORS.muted,
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<ViewLoader />}>
        {view === VIEWS.protocol ? (
          <OnchainPixelSite appConfig={appConfig} wallet={wallet} onConnectWallet={connectWallet} />
        ) : (
          <OnchainPixelEditor appConfig={appConfig} wallet={wallet} onConnectWallet={connectWallet} />
        )}
      </Suspense>
    </div>
  );
}
