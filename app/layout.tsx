import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "next-auth/react";

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
      <html lang="en">
        <body className="antialiased">
          {children}
          <Toaster />
        </body>
      </html>
    </SessionProvider>
  );
}
