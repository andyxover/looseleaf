import type { Metadata } from "next";
import { Geist, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ScrollProgress } from "@/components/ScrollProgress";
import { CursorGlow } from "@/components/decor/CursorGlow";
import { FloatingActions } from "@/components/FloatingActions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "wght"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Looseleaf — a photo journal",
  description: "A personal AI-laid-out magazine of moments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-zinc-900 selection:bg-accent selection:text-white dark:bg-paper-dark dark:text-zinc-100 dark:selection:bg-accent dark:selection:text-white">
        <ScrollProgress />
        <CursorGlow />
        {children}
        <FloatingActions />
      </body>
    </html>
  );
}
