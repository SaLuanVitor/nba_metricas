import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/header'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: 'NBA Stats Hub - Projecoes e Analytics',
  description: 'Plataforma de dados NBA com projecoes de jogadores, estatisticas e analytics para fantasy sports e betting',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="nba-stats-theme">
          <Header />
          <main className="container mx-auto px-4 py-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
