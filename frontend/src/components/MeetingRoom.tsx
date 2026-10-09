'use client';

import { useState } from 'react';
import {
  CallControls,
  CallParticipantsList,
  SpeakerLayout,
  PaginatedGridLayout,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { useRouter } from 'next/navigation';

// Placeholder components to satisfy Stream SDK layout TypeScript properties
const VideoPlaceholder = () => (
  <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-500 text-xs">
    Camera Off
  </div>
);

const PictureInPicturePlaceholder = () => null;

export default function MeetingRoom() {
  const router = useRouter();
  const [layout, setLayout] = useState<'grid' | 'speaker'>('speaker');
  const [showParticipants, setShowParticipants] = useState(false);

  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();

  if (callingState !== 'joined') {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-white flex items-center justify-center">
        <div className="text-sm font-mono animate-pulse">Connecting to Stream Video...</div>
      </div>
    );
  }

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#0d0f12] text-white flex flex-col justify-between">
      <div className="relative flex size-full items-center justify-center p-4">
        <div className="flex size-full max-w-[1100px] items-center">
          {layout === 'grid' ? (
            <PaginatedGridLayout
              VideoPlaceholder={VideoPlaceholder}
              PictureInPicturePlaceholder={PictureInPicturePlaceholder}
            />
          ) : (
            <SpeakerLayout
              participantsBarPosition="bottom"
              VideoPlaceholder={VideoPlaceholder}
              PictureInPicturePlaceholder={PictureInPicturePlaceholder}
            />
          )}
        </div>

        {showParticipants && (
          <aside className="h-[calc(100vh-86px)] w-80 bg-[#16191e] border-l border-slate-800 p-4 z-30">
            <CallParticipantsList onClose={() => setShowParticipants(false)} />
          </aside>
        )}
      </div>

      {/* CONTROL TOOLBAR */}
      <div className="fixed bottom-0 flex w-full items-center justify-center gap-3 bg-[#12151b] py-3 z-20 border-t border-slate-800/80">
        <CallControls onLeave={() => router.push('/')} />

        <button
          onClick={() => setLayout(layout === 'grid' ? 'speaker' : 'grid')}
          className="bg-[#1e232d] hover:bg-slate-700 px-4 py-2.5 rounded-full text-xs font-semibold transition"
        >
          {layout === 'grid' ? 'Speaker View' : 'Grid View'}
        </button>

        <button
          onClick={() => setShowParticipants((prev) => !prev)}
          className="bg-[#1e232d] hover:bg-slate-700 px-4 py-2.5 rounded-full text-xs font-semibold transition"
        >
          Participants
        </button>
      </div>
    </section>
  );
}