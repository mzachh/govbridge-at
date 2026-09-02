import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GovBridge AT Demo',
  description:
    'Synthetic MeineSV simulator. Twenty fictional claims, no real account required.',
  openGraph: { title: 'GovBridge AT Demo', images: ['/og.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
