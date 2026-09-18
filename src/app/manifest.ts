import type { MetadataRoute } from "next";

// PWA (prompt.md seção 3.10) — permite "Adicionar à tela inicial" no Android
// e iOS. Next.js serve isso automaticamente e já injeta a tag <link rel=
// "manifest"> no <head>, sem precisar de nada manual no layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grupo Mave CRM",
    short_name: "Mave CRM",
    description: "CRM interno do Grupo Mave — pipeline, contatos e atividades comerciais",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#255474",
    lang: "pt-BR",
    icons: [
      {
        src: "/logo-mark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-mark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
