import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Midas Publicity — Billing",
  description: "Invoice generator for Midas Publicity",
};

// Applies the saved theme before first paint so there's no flash of the
// wrong theme when it differs from the OS preference. Must stay in sync
// with the "midas.theme" key written by lib/store.ts (saveTheme).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("midas.theme");
    var theme = raw ? JSON.parse(raw) : null;
    if (theme === "dark" || theme === "light") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
