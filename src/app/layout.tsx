import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GLOSS - GitHub LinkedIn Open Source System",
  description:
    "GLOSS - Distribute your GitHub projects across LinkedIn and social media platforms with AI-powered content generation",
  icons: {
    icon: [
      { url: "/gloss-icon.svg", type: "image/svg+xml" },
      { url: "/gloss-icon.svg", type: "image/svg+xml", sizes: "32x32" },
    ],
    apple: "/gloss-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
