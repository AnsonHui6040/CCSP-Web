import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCSP — 東海選課規劃平台",
  description:
    "Course Choice & Schedule Planner — 課程查詢、候選池、預排課表、衝堂分析",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
