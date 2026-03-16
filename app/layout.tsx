import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { MigrationProvider } from "@/components/providers/MigrationProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LifeHub",
  description: "학습 & 자산 관리 올인원 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
        <MigrationProvider>
        <ThemeProvider>
          <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen">
              <Header />
              <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
                {children}
              </main>
            </div>
          </div>
          <MobileNav />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        </MigrationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
