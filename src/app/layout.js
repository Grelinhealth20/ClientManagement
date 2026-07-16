import "./globals.css";
import { Inter } from "next/font/google";
import SecurityGuard from "@/components/SecurityGuard";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Grelin Health — Client Onboarding & Tracking",
  description: "Enterprise client onboarding and tracking platform.",
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-ink antialiased">
        <SecurityGuard />
        {children}
      </body>
    </html>
  );
}
