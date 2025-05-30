import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

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
      <body className={geistSans.className}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen">
            <main className="pt-16 md:pt-4 flex-grow transition-all duration-300">
              <div className="max-w-6xl mx-auto px-4 sm:px-6">
                {children}
              </div>
            </main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}