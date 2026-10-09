import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ChatFloatingWidget } from "@/components/chat/ChatFloatingWidget";
import { Providers } from "@/components/Providers";
import NextTopLoader from "nextjs-toploader";
import { getRequestUser } from "@/lib/auth";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getRequestUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background text-foreground antialiased selection:bg-amber-400/25 selection:text-amber-950 font-sans"
      >
        <NextTopLoader
          color="#fbbf24"
          initialPosition={0.08}
          crawlSpeed={200}
          height={2.5}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #f59e0b,0 0 5px #f59e0b"
        />
        <Providers initialUser={user}>
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
