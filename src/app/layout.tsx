import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'YKB — You Know Ball',
  description: 'NBA niche stats trivia. Who had more?',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Google AdSense — must be in <head> so crawlers can verify it */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7874759706660952"
          crossOrigin="anonymous"
        />
        {/* H5 Games Ad Placement API — enables rewarded ad callbacks */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.adConfig = window.adConfig || function(o){(window.adsbygoogle=window.adsbygoogle||[]).push(o);};
              window.adBreak  = window.adBreak  || function(o){(window.adsbygoogle=window.adsbygoogle||[]).push(o);};
              window.adConfig({ preloadAdBreaks: 'on', sound: 'off' });
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
