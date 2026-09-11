import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Providers } from "@/components/providers";
import { auth } from "@/auth";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorkNest",
  description: "Your people. Your projects. One workspace.",
  icons: { icon: "/logo.png" },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full font-sans antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
