import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Providers } from "@/components/Providers";
import "@/styles/globals.css";

// Fonte da marca Way2: títulos em 700 e corpo em 300.
const nunitoSans = Nunito_Sans({
  weight: ["300", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito-sans",
});

export const metadata: Metadata = {
  title: "Scrum Poker",
  description: "Estimativas em pontos de Fibonacci, do skate ao avião.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A1730", // --w2-sup-escuro-pagina (a meta tag não aceita var CSS)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // O tema da marca é declarado, nunca segue prefers-color-scheme.
    <html lang="pt-BR" data-theme="dark" data-segmento="pdi" className={nunitoSans.variable}>
      <body>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
