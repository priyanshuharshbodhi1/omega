import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "next-auth/react";
import { Fraunces, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Omega",
  description:
    "Omega empowers businesses to effortlessly gather, analyze, and act on customer feedback with the power of AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SessionProvider>
      <html lang="en" className={`${spaceGrotesk.variable} ${fraunces.variable}`}>
        <body className="antialiased font-sans">
          {children}
          <Toaster />
        </body>
      </html>
    </SessionProvider>
  );
}
