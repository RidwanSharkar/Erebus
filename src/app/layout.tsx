import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Erebus',
  description: '3-Player Co-op Boss Battle Arena built with React Three Fiber and Socket.io',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="m-0 p-0 overflow-hidden">{children}</body>
    </html>
  )
}
