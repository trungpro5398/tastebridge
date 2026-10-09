import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
const body = Figtree({ variable: "--font-body", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tastebridge-brown.vercel.app"),
  title: "TasteBridge · decide together, fairly",
  description:
    "An AI agent that finds the one dinner spot or movie your whole group will enjoy, and shows exactly why, using Qloo's taste graph.",
};

export const viewport: Viewport = { themeColor: "#5b2a86" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5 pb-2">
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-8 rounded-[10px]" />
            TasteBridge
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted">
            <Link href="/#how" className="hover:text-foreground">
              How it works
            </Link>
            <a href="https://github.com/trungpro5398/tastebridge" className="hover:text-foreground">
              GitHub
            </a>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}
