"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(null); // 👈 start as null

  // ✅ Load theme ONLY once (initial load)
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");

    if (storedTheme) {
      setDark(storedTheme === "dark");
    } else {
      setDark(true); // default theme
    }
  }, []);

  // ✅ Save theme when it changes
  useEffect(() => {
    if (dark !== null) {
      localStorage.setItem("theme", dark ? "dark" : "light");
    }
  }, [dark]);

  // ⛔ prevent flicker before loading
  if (dark === null) return null;

  return (
    <ThemeContext.Provider value={{ dark, setDark }}>
      <div data-theme={dark ? "dark" : "light"} style={{ minHeight: "100vh" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);