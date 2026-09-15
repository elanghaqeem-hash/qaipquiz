import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'TRAINING QUIZ ARENA | Interactive • Competitive • Educational',
  description: 'Competitive Training Quiz Platform powered by GIAS 2024 & QAIP Question Bank',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className="min-h-screen flex flex-col antialiased selection:bg-blue-500 selection:text-white bg-slate-950">
        <Navbar />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
