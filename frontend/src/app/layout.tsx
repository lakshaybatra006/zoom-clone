import type { Metadata } from 'next';
import { StreamVideoProvider } from '../providers/StreamVideoProvider';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zoom Clone',
  description: 'Video Conferencing Application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0d0f12] text-white">
        <StreamVideoProvider>{children}</StreamVideoProvider>
      </body>
    </html>
  );
}