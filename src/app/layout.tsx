import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCM Issue Intelligence Portal",
  description: "Airtel SCM Issue Intelligence & Workflow Management",
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-airtel-black">{children}</body>
    </html>
  );
}
