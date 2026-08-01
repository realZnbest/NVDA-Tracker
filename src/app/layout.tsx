import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { RackNav } from "@/components/rack-nav";
import { AlertsProvider } from "@/components/alerts-provider";
import { EditSessionProvider } from "@/components/edit-session-provider";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "NVDA Instrument Wall",
  description: "แผงควบคุมข้อมูลหุ้น NVIDIA ส่วนตัว",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div
          style={{ display: "contents" }}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: A single-ticker analysis instrument, not a stock app -- the whole product reads as a
rack of live NVDA instrumentation panels in a data-center NOC, because NVDA's own business
(chips that run data centers) becomes the room you stand in to watch it. Refuses the literal
"Bloomberg clone" and the generic light-fintech-card-grid opposite.
OWN-WORLD: near-black graphite ground, rack-panel modules with hairline seams and corner
rivets, IBM Plex Mono telemetry numerals, IBM Plex Sans Thai UI copy, one named color per
data channel (amber=price, cyan=volume, violet=RSI, teal=MACD, red=alert) held everywhere
that channel appears.
STORY: owner opens the app and immediately scans NVDA's live instrument panel like an
operator reading a rack, not browsing a content feed; alerts light annunciator lamps.
FIRST VIEWPORT: annunciator strip, then module-tab nav, then live quote in amber telemetry,
then the price module (candles + MA/Bollinger overlay + volume) with RSI/MACD oscillator
panes stacked beneath, analysis panel alongside.
FORM: data-center NOC / instrument-wall, rank 4 of 7 derived candidates, seed key 6c4b073e.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, and DESIGN.md.
-->`,
          }}
        />
        <EditSessionProvider>
          <AlertsProvider>
            <RackNav />
            <main className="flex-1 min-w-0">{children}</main>
          </AlertsProvider>
        </EditSessionProvider>
      </body>
    </html>
  );
}
