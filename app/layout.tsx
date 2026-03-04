import { Geist, Geist_Mono } from "next/font/google";
import "../styles/main.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${sans.variable} ${mono.variable} min-h-[100dvh] antialiased`}
        style={{
          fontFamily: "var(--font-sans), system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
