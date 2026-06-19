import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: 'RailBook — Train Ticket Booking',
  description: 'Book train tickets across India. Fast, simple, reliable.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: '10px', fontSize: '14px' },
            success: { iconTheme: { primary: '#1e3a5f', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
