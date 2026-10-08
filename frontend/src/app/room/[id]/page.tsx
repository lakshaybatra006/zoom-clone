'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Copy, Check, Users, ShieldCheck, X, VolumeX, UserX, Crown
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isHost: boolean;
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const meetingId = params.id as string;
  const passcode = searchParams.get('pwd') || '';
  const userName = searchParams.get('name') || 'Alex Morgan';
  const isHostParam = searchParams.get('isHost') === 'true';

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Participant list with Host controls capability
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: `${userName} (You)`, isMuted: false, isVideoOff: false, isHost: isHostParam },
    { id: '2', name: 'Sarah Jenkins', isMuted: false, isVideoOff: true, isHost: false },
    { id: '3', name: 'David Miller', isMuted: true, isVideoOff: false, isHost: false },
  ]);

  useEffect(() => {
    async function enableStream() {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setStream(userStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = userStream;
        }
      } catch (err) {
        console.error("Camera/Microphone access error:", err);
      }
    }
    enableStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleEndCall = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    router.push('/');
  };

  const copyInvite = () => {
    const link = `${window.location.origin}/room/${meetingId}?pwd=${passcode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- HOST CONTROLS ---
  const handleMuteAll = () => {
    setParticipants((prev) =>
      prev.map((p) => (p.isHost ? p : { ...p, isMuted: true }))
    );
  };

  const handleMuteParticipant = (id: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isMuted: !p.isMuted } : p))
    );
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-zoom-bgDark text-white overflow-hidden">
      {/* Top Header */}
      <header className="h-14 bg-zoom-sidebarDark border-b border-gray-800 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-3">
          <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
          <span className="font-medium text-xs md:text-sm truncate">
            Meeting ID: <span className="font-mono text-gray-300">{meetingId}</span>
          </span>
        </div>
        <button 
          onClick={copyInvite}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-zoom-cardDark hover:bg-gray-700 rounded-lg border border-gray-700 transition"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          <span className="hidden sm:inline">{copied ? "Link Copied!" : "Copy Invite Link"}</span>
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Video Grid */}
        <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
          <div className="relative w-full max-w-4xl aspect-video bg-zoom-cardDark rounded-2xl overflow-hidden border border-gray-800 shadow-2xl flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : 'block'}`}
            />

            {isVideoOff && (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-zoom-blue flex items-center justify-center text-2xl md:text-3xl font-bold">
                  {userName.split(' ').map((n) => n[0]).join('')}
                </div>
                <p className="text-gray-300 font-medium">{userName}</p>
              </div>
            )}

            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-md backdrop-blur-sm text-xs font-medium flex items-center gap-2">
              {userName} (You)
              {isHostParam && <span className="bg-zoom-orange text-[10px] px-1.5 py-0.5 rounded font-bold">HOST</span>}
            </div>
          </div>
        </main>

        {/* Participants Side Drawer (Host Controls) */}
        {showParticipants && (
          <aside className="w-80 bg-zoom-sidebarDark border-l border-gray-800 flex flex-col justify-between p-4 z-30 absolute right-0 top-0 bottom-0 md:relative">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-800 mb-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-zoom-blue" />
                  Participants ({participants.length})
                </h3>
                <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Host Control Header Action */}
              {isHostParam && (
                <div className="mb-4">
                  <button 
                    onClick={handleMuteAll}
                    className="w-full py-2 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <VolumeX className="w-4 h-4" />
                    Mute All Participants
                  </button>
                </div>
              )}

              {/* Participant List */}
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 bg-zoom-cardDark/50 rounded-lg border border-gray-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-zoom-blue flex items-center justify-center text-xs font-bold shrink-0">
                        {p.name[0]}
                      </div>
                      <span className="text-xs font-medium truncate">{p.name}</span>
                      {p.isHost && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                    </div>

                    {/* Controls per participant */}
                    <div className="flex items-center gap-1">
                      {isHostParam && !p.isHost && (
                        <>
                          <button 
                            onClick={() => handleMuteParticipant(p.id)}
                            title={p.isMuted ? "Unmute" : "Mute"}
                            className="p-1.5 hover:bg-gray-700 rounded text-gray-300 hover:text-white"
                          >
                            {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5" />}
                          </button>
                          <button 
                            onClick={() => handleRemoveParticipant(p.id)}
                            title="Remove Participant"
                            className="p-1.5 hover:bg-red-600/20 rounded text-gray-400 hover:text-red-400"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Control Toolbar */}
      <footer className="h-20 bg-zoom-sidebarDark border-t border-gray-800 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={toggleAudio}
            className={`flex flex-col items-center gap-1 p-2.5 md:p-3 rounded-xl transition ${
              isMuted ? 'bg-red-600 hover:bg-red-700' : 'hover:bg-zoom-cardDark'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-gray-300" />}
            <span className="text-[10px] text-gray-400 hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button 
            onClick={toggleVideo}
            className={`flex flex-col items-center gap-1 p-2.5 md:p-3 rounded-xl transition ${
              isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'hover:bg-zoom-cardDark'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-gray-300" />}
            <span className="text-[10px] text-gray-400 hidden sm:inline">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
          </button>
        </div>

        <div>
          <button 
            onClick={handleEndCall}
            className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-red-600 hover:bg-red-700 font-semibold rounded-xl transition shadow-lg text-sm"
          >
            <PhoneOff className="w-4 h-4 md:w-5 md:h-5" />
            <span>End Meeting</span>
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-4 text-gray-400">
          <button 
            onClick={() => setShowParticipants(!showParticipants)}
            className={`flex flex-col items-center gap-1 p-2.5 md:p-3 rounded-xl transition ${
              showParticipants ? 'bg-zoom-cardDark text-white' : 'hover:bg-zoom-cardDark hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] hidden sm:inline">Participants</span>
          </button>
        </div>
      </footer>
    </div>
  );
}