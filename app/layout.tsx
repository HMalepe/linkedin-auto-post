import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/newsreader";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { UiProvider } from "./components/ui";

export const metadata: Metadata = {
  title: "Autoposter",
  description: "Claude drafts, you approve, it posts on schedule.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Autoposter", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f4f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1426" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UiProvider>{children}</UiProvider>
      </body>
    </html>
  );
}
