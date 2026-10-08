import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "LinkedIn Autoposter",
  description: "Claude drafts, you approve, it posts on schedule.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
