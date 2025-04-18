import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { Toaster } from "sonner";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "JobTracker - Manage Your Job Applications",
  description: "Track and manage your job applications efficiently with Google Sheets integration",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 no-overflow`}
      >
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Navbar />
            <div className="flex-1 overflow-y-auto w-full flex flex-col">
              <main className="flex-grow py-8 navbar-margin-adjustment">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                  {children}
                </div>
              </main>
              <div className="navbar-margin-adjustment">
                <Footer />
              </div>
            </div>
          </div>
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
