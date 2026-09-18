"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Em dev, o Turbopack pode reservir chunks de /_next/static/ na mesma URL
    // com conteúdo diferente a cada recompilação; um SW cache-first prenderia
    // o navegador numa versão antiga do bundle. Só vale a pena em produção,
    // onde os assets são hasheados por conteúdo.
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Limpa um SW registrado por uma versão anterior deste arquivo, que
      // registrava incondicionalmente mesmo em dev.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA é um extra — se o registro falhar, o app continua funcionando normalmente.
    });
  }, []);

  return null;
}
