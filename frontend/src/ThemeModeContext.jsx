import React, { createContext, useContext } from "react";

const ThemeModeContext = createContext("dark");

export function ThemeModeProvider({ value, children }) {
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
