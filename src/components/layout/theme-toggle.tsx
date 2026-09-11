"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Lê o tema já aplicado pelo script inline em layout.tsx (antes da
    // hidratação) — não dá para saber esse valor durante a renderização no
    // servidor, então sincronizar no mount é o único jeito.
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(current === "dark" ? "dark" : "light");
  }, []);

  function setTheme(next: "light" | "dark") {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mave-theme", next);
    } catch {
      // localStorage indisponível (modo privado) — tema não persiste, tudo bem
    }
    setThemeState(next);
  }

  return { theme, setTheme };
}

export function ThemeToggleMenuItem() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {isDark ? "Tema claro" : "Tema escuro"}
    </DropdownMenuItem>
  );
}
