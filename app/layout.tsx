import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteNav from "./components/site-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lyric Categorizer",
  description: "Predict artists from lyrics and explore a UMAP map of song semantics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(228,233,242,0.88)_45%,_rgba(209,219,231,0.78)_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,_rgba(48,54,64,0.92),_rgba(17,24,39,0.97)_50%,_rgba(3,7,18,1)_100%)]">
        <div className="flex min-h-screen flex-col">
          <SiteNav />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
