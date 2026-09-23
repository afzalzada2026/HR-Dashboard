import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATOMA · HR Workforce Intelligence",
  description: "Enterprise HR workforce analytics & intelligence portal for ATOMA — KPIs, interactive visuals, Afghanistan workforce map, org chart, AI insights and executive reporting.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#062B5B",
  width: "device-width",
  initialScale: 1,
};

const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('atoma-ui')||'{}');var t=s&&s.state&&s.state.theme;if(t!=='dark'&&t!=='atoma')t='light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
