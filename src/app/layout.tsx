import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { Toaster } from "@/components/ui/toaster";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Grupo Mave CRM",
    template: "%s · Mave CRM",
  },
  description: "CRM interno do Grupo Mave",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mave CRM",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#255474" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1318" },
  ],
};

// Aplica o tema antes da primeira pintura, evitando flash de tema errado.
// Preferência salva: "light" | "dark" | "system" (padrão: segue o sistema).
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("mave-theme");
    var pref = stored === "light" || stored === "dark" ? stored : "system";
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ServiceWorkerRegister />
        {children}
        <Toaster />
        <ConfirmDialogHost />
      </body>
    </html>
  );
}
