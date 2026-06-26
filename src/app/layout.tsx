import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-futuristic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VX-27",
  description: "First-person shooter prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={orbitron.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
