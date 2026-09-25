"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "mave-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(pref: ThemePreference) {
  const dark =
    pref === "dark" || (pref === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    // O tema já foi aplicado pelo script inline em app/layout.tsx antes da
    // hidratação; aqui só sincronizamos o estado do React com a preferência
    // salva (não dá para ler localStorage durante a renderização no servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferenceState(readPreference());
  }, []);

  // Com "Sistema", acompanha a troca de tema do SO em tempo real.
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function setPreference(next: ThemePreference) {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage indisponível (modo privado) — tema não persiste, tudo bem
    }
    applyTheme(next);
    setPreferenceState(next);
  }

  return { preference, setPreference };
}

export function ThemeToggleMenuItems() {
  const { preference, setPreference } = useTheme();

  return (
    <>
      <DropdownMenuLabel>Tema</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={preference}
        onValueChange={(value) => setPreference(value as ThemePreference)}
      >
        <DropdownMenuRadioItem value="system" onSelect={(e) => e.preventDefault()}>
          <Monitor />
          Sistema
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="light" onSelect={(e) => e.preventDefault()}>
          <Sun />
          Claro
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" onSelect={(e) => e.preventDefault()}>
          <Moon />
          Escuro
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}
