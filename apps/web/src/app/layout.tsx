import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Inter_Tight } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const display = Bodoni_Moda({ subsets: ["latin"], variable: "--font-bodoni", display: "swap" });
const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Vibear — Encontrá la ropa que viste", template: "%s — Vibear" },
  description: "Subí la foto de un look y encontrá dónde comprar cada prenda, ordenado por parecido.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:p-3 focus:text-micro">
          Saltar al contenido
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="mt-24 border-t border-line px-4 py-6 lg:px-8">
          <div className="flex flex-wrap justify-between gap-2 text-micro text-muted">
            <span>Vibear · MVP</span>
            <span>Resultados visuales vía Google Lens</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
