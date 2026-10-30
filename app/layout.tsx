import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.securepaddocksuk.co.uk"),
  title: {
    default: "Secure Paddocks UK",
    template: "%s · Secure Paddocks UK",
  },
  description:
    "Soar Valley K9 Secluded Retreat is a private secure dog field on Sileby Road, near Barrow upon Soar. One booking at a time.",
  applicationName: "Secure Paddocks UK",
  openGraph: {
    title: "Secure Paddocks UK",
    description: "A private secure dog field. One booking at a time, so the field is yours.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2F5D7B",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={sans.className}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main" className="page">
          {children}
        </main>
        <Footer />
        <PwaRegister />
      </body>
    </html>
  );
}
