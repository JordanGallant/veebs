import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";

import "../styles/main.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--mono",
  display: "swap",
});

const appleGaramond = localFont({
  src: [
    {
      path: "../public/fonts/AppleGaramond/AppleGaramond.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/AppleGaramond/AppleGaramond-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/AppleGaramond/AppleGaramond-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/AppleGaramond/AppleGaramond-LightItalic.woff2",
      weight: "300",
      style: "italic",
    },
    {
      path: "../public/fonts/AppleGaramond/AppleGaramond-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/AppleGaramond/AppleGaramond-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    }
  ],
  variable: "--apple-garamond",
});

export const metadata: Metadata = {
  title: "Cyber Twin Profile",
  description: "Frontend concept using the 3D_hero theme.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} ${appleGaramond.variable}`}>
        {children}
      </body>
    </html>
  );
}
