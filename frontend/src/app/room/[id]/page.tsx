'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  // State for room ID to handle hydration and prevent 'undefined' string
  const [roomId, setRoomId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [hasJoined, setHasJoined] = useState<boolean>(false);

  const [micOn, setMicOn] = useState<boolean>(true);
  const [camOn, setCamOn] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Resolve and validate Room ID dynamically
  useEffect(() => {
    const rawId = (params?.id || params?.roomId || searchParams?.get('id')) as string;

    if (rawId && rawId !== 'undefined' && rawId !== 'null') {
      setRoomId(rawId);
    } else {
      // Fallback 6-character room code if ID is missing or literally 'undefined'
      const fallback = Math.random().toString(36).substring(2, 8);
      setRoomId(fallback);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/room/${fallback}`);
      }
    }
  }, [params, searchParams]);

  // 2. Check for logged-in user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('zoom_clone_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed?.name) {
          setUserName(parsed.name);
          setHasJoined(true);
        }
      } catch (e) {
        console.error('Error parsing session user:', e);
      }
    }
  }, []);

  // 3. Initialize Camera & Mic MediaStream when user enters the room
  useEffect(() => {
    if (!hasJoined) return;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing camera/microphone:', err);
      }
    }

    initMedia();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [hasJoined]);

  // Toggle Microphone
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  // Toggle Camera
  const toggleCam = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  };

  // Copy Meeting Link
  const copyMeetingLink = () => {
    if (!roomId) return;
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // End Meeting & Return Home
  const handleEndMeeting = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    router.push('/');
  };

  // Handle Guest Display Name Form Submission
  const handleGuestJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      setHasJoined(true);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0d0f12] text-white flex flex-col justify-between select-none">
      {/* GUEST DISPLAY NAME MODAL */}
      {!hasJoined && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#16191e] border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-white">Join Meeting</h2>
            <p className="text-sm text-slate-400 mb-6">
              Please enter your display name to join room <span className="font-mono text-blue-400">{roomId || '...'}</span>.
            </p>

            <form onSubmit={handleGuestJoin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Your Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0d0f12] border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-white transition placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl font-semibold transition text-white shadow-lg shadow-blue-600/20"
              >
                Join Meeting
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TOP HEADER / BAR */}
      <header className="p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 bg-[#181c24] border border-slate-800/80 px-3 py-1.5 rounded-lg">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-xs font-mono text-slate-300">
            Meeting ID: <span className="text-white font-semibold">{roomId || 'Loading...'}</span>
          </span>
        </div>

        <button
          onClick={copyMeetingLink}
          title="Copy Meeting Link"
          className="bg-[#181c24] hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
        >
          {copied ? (
            <span className="text-xs text-emerald-400 font-medium">Link Copied!</span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium">Copy Link</span>
            </>
          )}
        </button>
      </header>

      {/* MAIN VIDEO AREA */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl aspect-video bg-[#12151b] border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          {camOn ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-300">
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="text-sm text-slate-400">Camera is turned off</span>
            </div>
          )}

          {/* OVERLAY USER LABEL */}
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 flex items-center gap-2">
            <span>{userName || 'Guest'} (You)</span>
            {!micOn && (
              <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
              </svg>
            )}
          </div>
        </div>
      </main>

      {/* BOTTOM CONTROLS BAR */}
      <footer className="p-4 bg-[#12151b]/90 border-t border-slate-800/80 backdrop-blur-lg flex items-center justify-between z-10">
        <button
          onClick={handleEndMeeting}
          className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
          title="Leave Room"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          {/* Mic Toggle */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              micOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30'
            }`}
            title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micOn ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
              </svg>
            )}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              camOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30'
            }`}
            title={camOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {camOn ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
              </svg>
            )}
          </button>

          {/* End Call Pill Button */}
          <button
            onClick={handleEndMeeting}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full flex items-center gap-2 transition shadow-lg shadow-red-600/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
            <span>End Meeting</span>
          </button>
        </div>

        <button
          className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
          title="Participants"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </button>
      </footer>
    </div>
  );
}