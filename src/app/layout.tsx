import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Grupo Mave CRM",
  description: "CRM interno do Grupo Mave",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mave CRM",
  },
};

export const viewport: Viewport = {
  themeColor: "#255474",
};

// Aplica o tema salvo antes da primeira pintura, evitando flash de tema errado.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("mave-theme");
    var theme = stored || "light";
    document.documentElement.setAttribute("data-theme", theme);
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
      </body>
    </html>
  );
}
