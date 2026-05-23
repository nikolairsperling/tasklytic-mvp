import type { Metadata, Viewport } from "next";
import { Inter, Lato, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import { ServiceWorkerCleanupClient } from "@/components/app-version-client";
import { getBuildVersion } from "@/lib/build-version";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lato = Lato({ subsets: ["latin"], weight: ["300", "400", "700"], variable: "--font-lato" });
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins" });

export const metadata: Metadata = {
  title: "Tasklytic Outreach",
  description: "Outreach, Landingpages und Lead-Automatisierung",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const buildVersion = getBuildVersion();

  return (
    <html lang="de" className={`${inter.variable} ${lato.variable} ${poppins.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var mode=localStorage.getItem("tasklytic-theme");if(mode!=="light"&&mode!=="dark"&&mode!=="system")mode="system";var dark=mode==="dark"||(mode==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var theme=dark?"dark":"light";var apply=function(target){if(!target)return;target.dataset.theme=theme;target.dataset.themeMode=mode;target.classList.remove("admin-light","admin-dark","theme-light","theme-dark","dark");target.classList.add("admin-theme","admin-"+theme,"theme-"+theme);};apply(document.documentElement);if(document.body)apply(document.body);else document.addEventListener("DOMContentLoaded",function(){apply(document.body);},{once:true});}catch(e){}})();`
          }}
        />
        <meta name="tasklytic-build-id" content={buildVersion} />
        <script src="/app-recovery.js" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="application-name" content="Tasklytic" />
      </head>
      <body>
        <ServiceWorkerCleanupClient />
        {children}
      </body>
    </html>
  );
}
