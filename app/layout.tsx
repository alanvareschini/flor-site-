import type { Metadata } from "next";
import { Geist_Mono, Outfit, Geist, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { SakuraLoader } from "@/components/site/sakura-loader";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-libre-baskerville",
  weight: ["400", "700"]
});

export const metadata: Metadata = {
  title: "Flor Alva | Desabrochar em Cena",
  description:
    "Uma experiencia cinematografica guiada pelo desabrochar de uma flor branca, entre luz, silencio e movimento.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "Flor Alva | Desabrochar em Cena",
    description:
      "Uma experiencia cinematografica guiada pelo desabrochar de uma flor branca, entre luz, silencio e movimento.",
    type: "website",
    locale: "pt_BR",
    siteName: "Flor Alva"
  },
  twitter: {
    card: "summary_large_image",
    title: "Flor Alva | Desabrochar em Cena",
    description:
      "Uma experiencia cinematografica guiada pelo desabrochar de uma flor branca, entre luz, silencio e movimento."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={cn(outfit.variable, geistMono.variable, libreBaskerville.variable, "font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <SakuraLoader />
        {children}
      </body>
    </html>
  );
}
