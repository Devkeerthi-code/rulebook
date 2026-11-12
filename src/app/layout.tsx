import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, Kalam } from "next/font/google";
import { Toaster } from "sonner";
import { IconSprite } from "@/components/icons";
import { MotionRuntime } from "@/components/motion/motion-runtime";
import "./globals.css";
import "./app.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-bricolage", display: "swap" });
const ui = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-plex", display: "swap" });
const hand = Kalam({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-kalam", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Rulebook — your college's rules, answered with the page number", template: "%s · Rulebook" },
  description:
    "Ask your college's handbook, regulations, placement policy and circulars in plain words. Every answer cites the document and page, and says so when the rule isn't there.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='5' y='3' width='22' height='26' fill='%231B1915'/%3E%3Cpath d='M19 3h6v13l-3-2.5-3 2.5z' fill='%23B83A0A'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F1E8" },
    { media: "(prefers-color-scheme: dark)", color: "#14120F" },
  ],
};

// Applies a saved manual theme before paint, so there's no flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem("rb-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${ui.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <IconSprite />
        {children}
        <MotionRuntime />
        <Toaster position="bottom-center" toastOptions={{ unstyled: true, classNames: { toast: "rb-toast", error: "rb-toast--error", success: "rb-toast--success" } }} />
      </body>
    </html>
  );
}
