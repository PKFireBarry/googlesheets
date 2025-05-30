import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "JobTracker - Manage Your Job Applications",
  description: "Track and manage your job applications efficiently with Google Sheets integration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={geistSans.className}>{children}</body>
    </html>
  );
}