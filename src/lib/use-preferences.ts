"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { UserPreferences } from "@/lib/preferences";

// Estado local das preferências + gravação no perfil do usuário. A tela
// muda na hora (otimista); a gravação é agrupada em 600ms para não gerar
// uma requisição por clique ao recolher várias colunas seguidas.
export function usePreferences(userId: string | null, initial: UserPreferences) {
  const [prefs, setPrefs] = useState<UserPreferences>(initial);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (patch: (current: UserPreferences) => UserPreferences) => {
      const next = patch(latest.current);
      latest.current = next;
      setPrefs(next);
      if (!userId) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from("profiles")
          .update({ preferences: latest.current as Record<string, unknown> })
          .eq("id", userId);
        if (error) {
          toast.warning("Não foi possível salvar sua preferência", {
            description: "Ela vale nesta tela, mas não será lembrada.",
          });
        }
      }, 600);
    },
    [userId],
  );

  return { prefs, update };
}
