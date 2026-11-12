// app/layout.jsx
import "./globals.css";

export const metadata = {
  title: "Tuneboard — Stream Music",
  description: "A Spotify-style music streaming player built with Next.js.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#121826",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#121826] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
