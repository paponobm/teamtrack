import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teamtrack - Employee Management",
  description: "Performance tracking and team management for Online Burmese Market",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
