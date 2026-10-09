'use client';

import { ReactNode, useEffect, useState } from 'react';
import { StreamVideo, StreamVideoClient } from '@stream-io/video-react-sdk';
import { tokenProvider } from '@/actions/stream.actions';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

export const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();

  useEffect(() => {
    if (!apiKey) return;

    let userId = 'user_' + Math.random().toString(36).substring(2, 9);
    let userName = 'Guest ' + userId.substring(5, 8);

    const savedUser = localStorage.getItem('zoom_clone_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.name) userName = parsed.name;
        if (parsed.id) userId = parsed.id;
      } catch (e) {}
    } else {
      localStorage.setItem('zoom_clone_user', JSON.stringify({ id: userId, name: userName }));
    }

    const client = new StreamVideoClient({
      apiKey,
      user: {
        id: userId,
        name: userName,
      },
      tokenProvider: () => tokenProvider(userId),
    });

    setVideoClient(client);

    return () => {
      client.disconnectUser();
    };
  }, []);

  if (!videoClient) {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-white flex items-center justify-center">
        <div className="text-sm font-mono animate-pulse">Initializing Stream Video Client...</div>
      </div>
    );
  }

  return <StreamVideo client={videoClient}>{children}</StreamVideo>;
};