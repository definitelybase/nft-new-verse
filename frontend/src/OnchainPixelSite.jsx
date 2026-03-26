import React, { useState } from "react";
import usePoolData from "./usePoolData";
import { COLORS } from "./utils/constants";
import { buildPoolView, getTargetChainId } from "./utils/helpers";
import { FloatingNav, SiteMotionStyles } from "./components/ui";
import HomePage from "./pages/HomePage";
import MarketplacePage from "./pages/MarketplacePage";
import MintPage from "./pages/MintPage";
import StakingPage from "./pages/StakingPage";

export default function OnchainPixelSite({ appConfig, wallet, onConnectWallet, themeMode, onToggleTheme }) {
  const [page, setPage] = useState("home");
  const targetChainId = getTargetChainId(appConfig);
  const { data: liveData, error: poolError } = usePoolData({
    poolAddress: appConfig?.poolAddress,
    routerAddress: appConfig?.routerAddress,
    rpcUrl: appConfig?.rpcUrl,
    ethUsd: appConfig?.ethUsd,
    walletProvider: wallet?.provider,
  });

  const pool = buildPoolView(liveData);
  const isLive = Boolean(liveData);

  return (
    <div
      style={{
        minHeight: "100vh",
        color: COLORS.text,
        background: "transparent",
      }}
    >
      <SiteMotionStyles />
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <FloatingNav
        page={page}
        setPage={setPage}
        wallet={wallet}
        onConnectWallet={onConnectWallet}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
        targetChainId={targetChainId}
      />
      {page === "home" && <HomePage setPage={setPage} pool={pool} isLive={isLive} poolError={poolError} />}
      {page === "mint" && <MintPage wallet={wallet} appConfig={appConfig} pool={pool} isLive={isLive} poolError={poolError} />}
      {page === "market" && <MarketplacePage pool={pool} isLive={isLive} wallet={wallet} appConfig={appConfig} poolError={poolError} />}
      {page === "staking" && <StakingPage pool={pool} isLive={isLive} wallet={wallet} appConfig={appConfig} poolError={poolError} />}
    </div>
  );
}
