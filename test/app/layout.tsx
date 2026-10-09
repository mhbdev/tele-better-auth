import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "Testing tele-better-auth plugin",
  title: "Better Auth + Telegram Test",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
