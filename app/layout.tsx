import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import SiteNav from "./components/site-nav";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lyric Categorizer",
  description: "Predict artists from lyrics and explore hierarchical song clusters on a UMAP projection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(246,236,216,0.9),_rgba(232,220,194,0.9)_45%,_rgba(216,198,159,0.85)_100%)] text-foreground">
        <div className="flex h-full flex-col overflow-hidden">
          <SiteNav />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
