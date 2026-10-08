import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tastebridge-brown.vercel.app"),
  title: "TasteBridge · decide together, fairly",
  description:
    "An AI agent that finds the one dinner spot or movie your whole group will enjoy, and shows exactly why, using Qloo's taste graph.",
};

export const viewport: Viewport = { themeColor: "#e2553a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="mx-auto w-full max-w-3xl px-4 pt-5 pb-2 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-8 rounded-xl" />
            TasteBridge
          </Link>
          <span className="text-xs text-muted">Powered by Qloo × Claude</span>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}
