import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "AutoProfit Pro",
  description: "Workshop financial & accounting dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
