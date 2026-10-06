import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ChatFloatingWidget } from "@/components/chat/ChatFloatingWidget";
import { Providers } from "@/components/Providers";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Humantek Art — Creator Credits Studio",
  description: "Plan approved Humantek Art creative services with scope-based credits, package balances, revisions, and project tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`light ${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased selection:bg-amber-500/20 selection:text-amber-900 font-sans">
        <Providers>
          <TooltipProvider>
            {children}
            <ChatFloatingWidget />
            <Toaster position="bottom-left" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
