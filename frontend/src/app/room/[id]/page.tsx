'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://zoom-clone-4-zp2h.onrender.com";

// Public STUN Servers for NAT Traversal (Mobile 5G <-> Desktop Wi-Fi)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface Participant {
  id: string;
  name: string;
  status: 'admitted' | 'waiting';
  is_host: boolean;
}

interface RemotePeer {
  peerId: string;
  name: string;
  stream: MediaStream;
}

// Component to render Remote Participant Video & Audio Stream
function RemoteVideoTile({ peer }: { peer: RemotePeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      // Ensure audio plays unmuted on remote participant tile
      videoRef.current.play().catch((err) => {
        console.warn('Autoplay audio interaction needed:', err);
      });
    }
  }, [peer.stream]);

  return (
    <div className="relative w-full h-full bg-[#12151b] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 flex items-center gap-2">
        <span>{peer.name}</span>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  // State for Room & User
  const [roomId, setRoomId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [hasSubmittedName, setHasSubmittedName] = useState<boolean>(false);

  // Host vs Guest State
  const [isHost, setIsHost] = useState<boolean>(false);
  const [myStatus, setMyStatus] = useState<'admitted' | 'waiting'>('waiting');
  const [myParticipantId, setMyParticipantId] = useState<string>('');
  const [hostName, setHostName] = useState<string>('');

  // UI & Control States
  const [micOn, setMicOn] = useState<boolean>(true);
  const [camOn, setCamOn] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [showParticipants, setShowParticipants] = useState<boolean>(false);

  // Participants Lists & WebRTC Remote Streams
  const [admittedParticipants, setAdmittedParticipants] = useState<Participant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const socketRef = useRef<WebSocket | null>(null);

  // 1. Resolve Room ID & Host Flag
  useEffect(() => {
    const rawId = (params?.id || params?.roomId || searchParams?.get('id')) as string;
    const isHostQuery = searchParams?.get('host') === 'true';

    if (rawId && rawId !== 'undefined' && rawId !== 'null') {
      setRoomId(rawId);
    } else {
      const fallback = Math.random().toString(36).substring(2, 8);
      setRoomId(fallback);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/room/${fallback}`);
      }
    }

    if (isHostQuery) {
      setIsHost(true);
      setMyStatus('admitted');
    }
  }, [params, searchParams]);

  // 2. Load session user on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('zoom_clone_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed?.name) {
          setUserName(parsed.name);
          setHasSubmittedName(true);
        }
      } catch (e) {
        console.error('Error parsing session user:', e);
      }
    }
  }, []);

  // 3. Register user with room backend
  useEffect(() => {
    if (!hasSubmittedName || !roomId || !userName) return;

    async function registerParticipant() {
      try {
        const pid = myParticipantId || 'p_' + Math.random().toString(36).substring(2, 9);
        setMyParticipantId(pid);

        const res = await fetch(`${API_BASE}/api/meetings/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userName,
            is_host: isHost,
            participant_id: pid,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.is_host) {
            setIsHost(true);
            setMyStatus('admitted');
          } else {
            setMyStatus(data.status);
          }
          if (data.host_name) setHostName(data.host_name);
        } else {
          if (isHost) setMyStatus('admitted');
        }
      } catch (e) {
        if (isHost) setMyStatus('admitted');
      }
    }

    registerParticipant();
  }, [hasSubmittedName, roomId, userName]);

  // 4. Initialize Local Camera & Microphone Stream when Admitted
  useEffect(() => {
    if (myStatus !== 'admitted') return;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing camera/microphone:', err);
      }
    }

    initMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [myStatus]);

  // 5. Real-Time WebRTC Peer Connection & Signaling Setup
  useEffect(() => {
    if (myStatus !== 'admitted' || !roomId || !userName) return;

    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/ws/${roomId}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'join',
        sender: userName,
        participantId: myParticipantId,
      }));
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, sender, offer, answer, candidate } = msg;

        if (sender === userName) return; // Ignore own messages

        if (type === 'join') {
          // Initiate WebRTC offer to new peer
          createPeerConnection(sender, true);
        } else if (type === 'offer' && offer) {
          // Receive WebRTC offer and reply with answer
          const pc = createPeerConnection(sender, false);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          socket.send(JSON.stringify({
            type: 'answer',
            sender: userName,
            target: sender,
            answer: ans,
          }));
        } else if (type === 'answer' && answer) {
          const pc = peerConnections.current[sender];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } else if (type === 'candidate' && candidate) {
          const pc = peerConnections.current[sender];
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (e) {
        console.error('WebRTC Signaling Error:', e);
      }
    };

    function createPeerConnection(peerName: string, isInitiator: boolean): RTCPeerConnection {
      if (peerConnections.current[peerName]) {
        return peerConnections.current[peerName];
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current[peerName] = pc;

      // Add local audio and video tracks to WebRTC peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Receive remote stream (Audio & Video)
      pc.ontrack = (evt) => {
        const remoteStream = evt.streams[0];
        setRemotePeers((prev) => {
          if (prev.some((p) => p.peerId === peerName)) return prev;
          return [...prev, { peerId: peerName, name: peerName, stream: remoteStream }];
        });
      };

      // Send ICE candidates over WebSocket
      pc.onicecandidate = (evt) => {
        if (evt.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'candidate',
            sender: userName,
            target: peerName,
            candidate: evt.candidate,
          }));
        }
      };

      if (isInitiator) {
        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'offer',
              sender: userName,
              target: peerName,
              offer: offer,
            }));
          }
        });
      }

      return pc;
    }

    return () => {
      socket.close();
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
    };
  }, [myStatus, roomId, userName, myParticipantId]);

  // 6. Polling Room State for Participants & Waiting Room
  useEffect(() => {
    if (!hasSubmittedName || !roomId) return;

    async function fetchRoomState() {
      try {
        const res = await fetch(`${API_BASE}/api/meetings/${roomId}/state`);
        if (res.ok) {
          const data = await res.json();
          setAdmittedParticipants(data.admitted || []);
          setWaitingParticipants(data.waiting || []);
          if (data.host_name) setHostName(data.host_name);

          if (myParticipantId) {
            const meInAdmitted = (data.admitted || []).find((p: Participant) => p.id === myParticipantId || p.name === userName);
            if (meInAdmitted) {
              setMyStatus('admitted');
            }
          }
        }
      } catch (e) {
        setAdmittedParticipants([{ id: 'self', name: userName, status: 'admitted', is_host: isHost }]);
      }
    }

    fetchRoomState();
    const interval = setInterval(fetchRoomState, 1500);

    return () => clearInterval(interval);
  }, [hasSubmittedName, roomId, myParticipantId, userName, isHost]);

  // Host Action: Admit Participant
  const handleAdmit = async (participantId: string) => {
    try {
      await fetch(`${API_BASE}/api/meetings/${roomId}/admit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: participantId }),
      });
      setWaitingParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (e) {
      console.error('Error admitting participant:', e);
    }
  };

  // Host Action: Reject Participant
  const handleReject = async (participantId: string) => {
    try {
      await fetch(`${API_BASE}/api/meetings/${roomId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: participantId }),
      });
      setWaitingParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (e) {
      console.error('Error rejecting participant:', e);
    }
  };

  // Toggle Microphone
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  // Toggle Camera
  const toggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
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
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    router.push('/');
  };

  const handleGuestSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      setHasSubmittedName(true);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0d0f12] text-white flex flex-col justify-between select-none overflow-hidden font-sans">
      
      {/* 1. GUEST NAME MODAL */}
      {!hasSubmittedName && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#16191e] border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-white">Join Meeting</h2>
            <p className="text-sm text-slate-400 mb-6">
              Enter your display name to join room <span className="font-mono text-blue-400">{roomId || '...'}</span>.
            </p>
            <form onSubmit={handleGuestSubmitName} className="space-y-4">
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
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition text-white shadow-lg shadow-blue-600/20"
              >
                Join Meeting
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. GUEST WAITING ROOM SCREEN */}
      {hasSubmittedName && myStatus === 'waiting' && !isHost && (
        <div className="fixed inset-0 bg-[#0b0d10] flex flex-col items-center justify-center z-40 p-6 text-center">
          <div className="bg-[#16191e] border border-slate-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6 animate-pulse">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Please wait, the meeting host will let you in soon.</h2>
            <p className="text-xs text-slate-400 mb-6">
              Meeting ID: <span className="text-slate-200 font-mono font-semibold">{roomId}</span> | Joined as <span className="text-blue-400 font-medium">{userName}</span>
            </p>
            {hostName && (
              <div className="bg-slate-900 border border-slate-800/80 px-4 py-2 rounded-xl text-xs text-slate-300 mb-6">
                Host: <span className="font-semibold text-white">{hostName}</span>
              </div>
            )}
            <button
              onClick={handleEndMeeting}
              className="px-6 py-2.5 bg-slate-800 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              Leave Meeting
            </button>
          </div>
        </div>
      )}

      {/* 3. HOST ADMISSION TOAST BANNER */}
      {isHost && waitingParticipants.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#1c2230] border border-blue-500/40 p-3 px-5 rounded-2xl shadow-2xl z-50 flex items-center gap-4 animate-bounce">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
            <span className="text-xs font-semibold text-white">
              {waitingParticipants[0]?.name} requested to join the meeting
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdmit(waitingParticipants[0].id)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
            >
              Admit
            </button>
            <button
              onClick={() => handleReject(waitingParticipants[0].id)}
              className="bg-slate-800 hover:bg-red-600/80 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-semibold transition"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
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

      {/* MAIN VIDEO GRID & PARTICIPANTS PANEL */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex items-center justify-center p-4">
          <div className={`w-full max-w-5xl h-full grid gap-4 items-center justify-center ${
            remotePeers.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}>
            
            {/* LOCAL USER TILE (MUST BE MUTED TO AVOID ECHO) */}
            <div className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
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

              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 flex items-center gap-2">
                <span>{userName || 'Guest'} {isHost ? '(Host, You)' : '(You)'}</span>
                {!micOn && (
                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                  </svg>
                )}
              </div>
            </div>

            {/* REMOTE PARTICIPANT VIDEO TILES (LIVE AUDIO & VIDEO) */}
            {remotePeers.map((peer) => (
              <RemoteVideoTile key={peer.peerId} peer={peer} />
            ))}

          </div>
        </main>

        {/* PARTICIPANTS SIDEBAR */}
        {showParticipants && (
          <aside className="w-80 bg-[#16191e] border-l border-slate-800/80 p-4 flex flex-col justify-between z-30">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Participants</span>
                  <span className="bg-blue-600/30 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">
                    {admittedParticipants.length}
                  </span>
                </h3>
                <button onClick={() => setShowParticipants(false)} className="text-slate-400 hover:text-white p-1">
                  ✕
                </button>
              </div>

              {/* WAITING ROOM (HOST ONLY) */}
              {isHost && waitingParticipants.length > 0 && (
                <div className="mb-6 bg-[#0f1218] border border-blue-500/30 rounded-xl p-3">
                  <div className="text-xs font-semibold text-blue-400 mb-2 flex items-center justify-between">
                    <span>Waiting Room ({waitingParticipants.length})</span>
                  </div>

                  <div className="space-y-2">
                    {waitingParticipants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-[#16191e] rounded-lg border border-slate-800">
                        <span className="text-xs font-medium text-slate-200">{p.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleAdmit(p.id)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold px-2 py-1 rounded"
                          >
                            Admit
                          </button>
                          <button
                            onClick={() => handleReject(p.id)}
                            className="bg-slate-800 hover:bg-red-600/80 text-slate-300 text-[10px] font-semibold px-2 py-1 rounded"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ADMITTED PARTICIPANTS LIST */}
              <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                {admittedParticipants.map((participant, index) => (
                  <div key={participant.id || index} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d0f12] border border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                        {participant.name ? participant.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="text-xs font-semibold text-slate-200">
                        {participant.name} {participant.is_host ? '(Host)' : ''} {participant.name === userName ? '(You)' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={copyMeetingLink}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 mt-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Invite Participants</span>
            </button>
          </aside>
        )}
      </div>

      {/* BOTTOM CONTROLS BAR */}
      <footer className="p-4 bg-[#12151b]/90 border-t border-slate-800/80 backdrop-blur-lg flex items-center justify-between z-10">
        <button
          onClick={handleEndMeeting}
          className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              micOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/30'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          <button
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              camOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/30'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={handleEndMeeting}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full flex items-center gap-2 transition shadow-lg shadow-red-600/30"
          >
            <span>End Meeting</span>
          </button>
        </div>

        <button
          onClick={() => setShowParticipants(!showParticipants)}
          className={`relative w-10 h-10 rounded-full flex items-center justify-center transition ${
            showParticipants ? 'bg-blue-600 text-white' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          {waitingParticipants.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {waitingParticipants.length}
            </span>
          )}
        </button>
      </footer>
    </div>
  );
}