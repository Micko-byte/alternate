import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "alternate-theme";

type ThemeState = { choice: ThemeChoice; resolved: "light" | "dark"; setChoice: (choice: ThemeChoice, origin?: { x: number; y: number }) => void };

const ThemeContext = createContext<ThemeState | undefined>(undefined);

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function apply(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#121110" : "#FFFFFF");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [systemIsDark, setSystemIsDark] = useState(systemDark);
  const resolved = choice === "system" ? (systemIsDark ? "dark" : "light") : choice;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemIsDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => apply(resolved), [resolved]);

  const setChoice = useCallback((next: ThemeChoice, origin?: { x: number; y: number }) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: choice lasts for this visit */
    }
    const nextResolved = next === "system" ? (systemDark() ? "dark" : "light") : next;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };

    if (!reduced && doc.startViewTransition && nextResolved !== (root.classList.contains("dark") ? "dark" : "light")) {
      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? 0;
      root.style.setProperty("--theme-x", `${x}px`);
      root.style.setProperty("--theme-y", `${y}px`);
      root.style.setProperty("--theme-r", `${Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))}px`);
      doc.startViewTransition(() => {
        flushSync(() => setChoiceState(next));
        apply(nextResolved);
      });
      return;
    }

    if (!reduced) {
      root.classList.add("theme-fade");
      window.setTimeout(() => root.classList.remove("theme-fade"), 500);
    }
    setChoiceState(next);
  }, []);

  return <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
