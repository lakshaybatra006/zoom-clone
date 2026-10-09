'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://zoom-clone-4-zp2h.onrender.com";

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
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

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
}

interface ActiveReaction {
  id: string;
  sender: string;
  emoji: string;
}

function RemoteVideoTile({ peer, reaction }: { peer: RemotePeer; reaction?: ActiveReaction }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioBlocked, setAudioBlocked] = useState<boolean>(false);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setAudioBlocked(false))
          .catch(() => setAudioBlocked(true));
      }
    }

    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
      audioRef.current
        .play()
        .then(() => setAudioBlocked(false))
        .catch(() => setAudioBlocked(true));
    }
  }, [peer.stream]);

  const handleEnableAudio = () => {
    if (videoRef.current) videoRef.current.play().catch((err) => console.error(err));
    if (audioRef.current) audioRef.current.play().catch((err) => console.error(err));
    setAudioBlocked(false);
  };

  return (
    <div className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <audio ref={audioRef} autoPlay playsInline />

      {audioBlocked && (
        <button
          onClick={handleEnableAudio}
          className="absolute inset-0 m-auto w-max h-max bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2.5 rounded-xl font-semibold shadow-2xl z-30 animate-pulse border border-blue-400/50 flex items-center gap-2"
        >
          <span>🔊 Tap to Unmute Remote Audio</span>
        </button>
      )}

      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 flex items-center gap-2 z-10">
        <span>{peer.name}</span>
      </div>

      {reaction && (
        <div className="absolute top-6 right-6 bg-black/70 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl text-3xl animate-bounce shadow-2xl z-20">
          {reaction.emoji}
        </div>
      )}
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [roomId, setRoomId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [hasSubmittedName, setHasSubmittedName] = useState<boolean>(false);

  const [isHost, setIsHost] = useState<boolean>(false);
  const [myStatus, setMyStatus] = useState<'admitted' | 'waiting'>('waiting');
  const [myParticipantId, setMyParticipantId] = useState<string>('');
  const [hostName, setHostName] = useState<string>('');

  const [micOn, setMicOn] = useState<boolean>(true);
  const [camOn, setCamOn] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [localStreamReady, setLocalStreamReady] = useState<boolean>(false);

  const [activeSidebar, setActiveSidebar] = useState<'none' | 'participants' | 'chat'>('none');
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  const [admittedParticipants, setAdmittedParticipants] = useState<Participant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const iceCandidatesQueue = useRef<{ [key: string]: RTCIceCandidateInit[] }>({});
  const socketRef = useRef<WebSocket | null>(null);

  const removePeerConnection = (peerName: string) => {
    if (peerConnections.current[peerName]) {
      try {
        peerConnections.current[peerName].close();
      } catch (e) {}
      delete peerConnections.current[peerName];
    }
    delete iceCandidatesQueue.current[peerName];

    setRemotePeers((prev) => prev.filter((p) => p.peerId !== peerName && p.name !== peerName));
    setAdmittedParticipants((prev) => prev.filter((p) => p.name !== peerName && p.id !== peerName));
  };

  const createPeerConnection = (peerName: string, isInitiator: boolean): RTCPeerConnection => {
    if (peerConnections.current[peerName]) {
      return peerConnections.current[peerName];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[peerName] = pc;

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        removePeerConnection(peerName);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (evt) => {
      const remoteTrack = evt.track;
      const incomingStream = evt.streams[0] || new MediaStream([remoteTrack]);

      setRemotePeers((prev) => {
        const existingIndex = prev.findIndex((p) => p.peerId === peerName || p.name === peerName);
        if (existingIndex !== -1) {
          const existingPeer = prev[existingIndex];
          if (!existingPeer.stream.getTracks().some((t) => t.id === remoteTrack.id)) {
            existingPeer.stream.addTrack(remoteTrack);
          }
          const updated = [...prev];
          updated[existingIndex] = { ...existingPeer, stream: existingPeer.stream };
          return updated;
        } else {
          return [...prev, { peerId: peerName, name: peerName, stream: incomingStream }];
        }
      });
    };

    pc.onicecandidate = (evt) => {
      if (evt.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'candidate',
            sender: userName,
            target: peerName,
            candidate: evt.candidate,
          })
        );
      }
    };

    if (isInitiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'offer',
              sender: userName,
              target: peerName,
              offer: offer,
            })
          );
        }
      });
    }

    return pc;
  };

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

  useEffect(() => {
    const savedUser = localStorage.getItem('zoom_clone_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed?.name) {
          setUserName(parsed.name);
          setHasSubmittedName(true);
        }
      } catch (e) {}
    }
  }, []);

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
        } else if (isHost) {
          setMyStatus('admitted');
        }
      } catch (e) {
        if (isHost) setMyStatus('admitted');
      }
    }

    registerParticipant();
  }, [hasSubmittedName, roomId, userName]);

  useEffect(() => {
    if (myStatus !== 'admitted') return;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setLocalStreamReady(true);
      } catch (err) {
        console.error('Media access error:', err);
        setLocalStreamReady(true);
      }
    }

    initMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [myStatus]);

  useEffect(() => {
    if (myStatus !== 'admitted' || !roomId || !userName || !localStreamReady) return;

    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/ws/${roomId}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'join',
          sender: userName,
          participantId: myParticipantId,
        })
      );
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, sender, target, offer, answer, candidate, text, time, emoji } = msg;

        if (sender === userName) return;
        if (target && target !== userName) return;

        if (type === 'leave' || type === 'user_left') {
          removePeerConnection(sender);
          return;
        }

        if (type === 'join' || type === 'admitted') {
          const shouldOffer = userName.localeCompare(sender) > 0;
          createPeerConnection(sender, shouldOffer);
        } else if (type === 'offer' && offer) {
          const pc = createPeerConnection(sender, false);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          if (iceCandidatesQueue.current[sender]) {
            for (const cand of iceCandidatesQueue.current[sender]) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            iceCandidatesQueue.current[sender] = [];
          }

          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          socket.send(
            JSON.stringify({
              type: 'answer',
              sender: userName,
              target: sender,
              answer: ans,
            })
          );
        } else if (type === 'answer' && answer) {
          const pc = peerConnections.current[sender];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));

            if (iceCandidatesQueue.current[sender]) {
              for (const cand of iceCandidatesQueue.current[sender]) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              }
              iceCandidatesQueue.current[sender] = [];
            }
          }
        } else if (type === 'candidate' && candidate) {
          const pc = peerConnections.current[sender];
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          } else {
            if (!iceCandidatesQueue.current[sender]) {
              iceCandidatesQueue.current[sender] = [];
            }
            iceCandidatesQueue.current[sender].push(candidate);
          }
        } else if (type === 'chat') {
          const newMsg: ChatMessage = {
            id: 'msg-' + Date.now() + Math.random(),
            sender: sender,
            text: text,
            time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: sender === userName,
          };
          setChatMessages((prev) => [...prev, newMsg]);
          if (activeSidebar !== 'chat') setUnreadChatCount((prev) => prev + 1);
        } else if (type === 'reaction') {
          const reactionId = 'react-' + Date.now();
          setActiveReactions((prev) => [...prev, { id: reactionId, sender, emoji }]);
          setTimeout(() => {
            setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
          }, 3500);
        }
      } catch (e) {
        console.error('Signaling error:', e);
      }
    };

    return () => {
      socket.close();
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
    };
  }, [myStatus, roomId, userName, myParticipantId, localStreamReady]);

  useEffect(() => {
    if (!hasSubmittedName || !roomId) return;

    async function fetchRoomState() {
      try {
        const res = await fetch(`${API_BASE}/api/meetings/${roomId}/state`);
        if (res.ok) {
          const data = await res.json();
          const admittedList = data.admitted || [];
          setAdmittedParticipants(admittedList);
          setWaitingParticipants(data.waiting || []);
          if (data.host_name) setHostName(data.host_name);

          const admittedNames = new Set(admittedList.map((p: Participant) => p.name));
          setRemotePeers((prev) => prev.filter((peer) => admittedNames.has(peer.name) || admittedNames.has(peer.peerId)));

          if (myParticipantId) {
            const meInAdmitted = admittedList.find((p: Participant) => p.id === myParticipantId || p.name === userName);
            if (meInAdmitted) setMyStatus('admitted');
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

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !camOn;
        setCamOn(!camOn);
      }
    }
  };

  const copyMeetingLink = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEndMeeting = async () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'leave',
          sender: userName,
          participantId: myParticipantId,
        })
      );
    }

    if (roomId && myParticipantId) {
      try {
        await fetch(`${API_BASE}/api/meetings/${roomId}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant_id: myParticipantId }),
        });
      } catch (e) {}
    }

    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    Object.values(peerConnections.current).forEach((pc) => pc.close());

    router.push('/');
  };

  const handleGuestSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) setHasSubmittedName(true);
  };

  return (
    <div className="relative min-h-screen bg-[#0d0f12] text-white flex flex-col justify-between select-none overflow-hidden font-sans">
      {!hasSubmittedName && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#16191e] border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-white">Join Meeting</h2>
            <p className="text-sm text-slate-400 mb-6">
              Enter your display name to join room <span className="font-mono text-blue-400">{roomId || '...'}</span>.
            </p>
            <form onSubmit={handleGuestSubmitName} className="space-y-4">
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d0f12] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-white transition"
              >
                Join Meeting
              </button>
            </form>
          </div>
        </div>
      )}

      {hasSubmittedName && myStatus === 'waiting' && !isHost && (
        <div className="fixed inset-0 bg-[#0b0d10] flex flex-col items-center justify-center z-40 p-6 text-center">
          <div className="bg-[#16191e] border border-slate-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-2">Please wait, the meeting host will let you in soon.</h2>
            <button
              onClick={handleEndMeeting}
              className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              Leave Meeting
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="p-4 flex items-center justify-between z-10">
        <div className="bg-[#181c24] border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
          Meeting ID: <span className="text-white font-semibold">{roomId}</span>
        </div>
        <button
          onClick={copyMeetingLink}
          className="bg-[#181c24] hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 transition"
        >
          {copied ? 'Link Copied!' : 'Copy Link'}
        </button>
      </header>

      {/* MAIN VIDEO GRID */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl h-full grid gap-4 items-center justify-center grid-cols-1 md:grid-cols-2">
          {/* LOCAL USER TILE */}
          <div className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
            {camOn ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="-scale-x-100 w-full h-full object-cover" />
            ) : (
              <div className="text-slate-400 text-sm">Camera is turned off</div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200">
              {userName} (You)
            </div>
          </div>

          {/* REMOTE PARTICIPANTS */}
          {admittedParticipants
            .filter((p) => p.name !== userName && p.id !== myParticipantId)
            .map((p) => {
              const peer = remotePeers.find((peer) => peer.name === p.name || peer.peerId === p.name);
              if (peer && peer.stream) {
                return <RemoteVideoTile key={p.id || p.name} peer={peer} />;
              }
              return (
                <div key={p.id || p.name} className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/80 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                  Connecting to {p.name}...
                </div>
              );
            })}
        </div>
      </main>

      {/* FOOTER TOOLBAR */}
      <footer className="p-4 bg-[#12151b]/90 border-t border-slate-800/80 flex items-center justify-center gap-4 z-10">
        <button
          onClick={toggleMic}
          className={`px-4 py-2.5 rounded-full text-xs font-semibold ${micOn ? 'bg-slate-800 text-white' : 'bg-red-500/20 text-red-500'}`}
        >
          {micOn ? 'Mute Mic' : 'Unmute Mic'}
        </button>
        <button
          onClick={toggleCam}
          className={`px-4 py-2.5 rounded-full text-xs font-semibold ${camOn ? 'bg-slate-800 text-white' : 'bg-red-500/20 text-red-500'}`}
        >
          {camOn ? 'Stop Video' : 'Start Video'}
        </button>
        <button
          onClick={handleEndMeeting}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-full shadow-lg"
        >
          End Meeting
        </button>
      </footer>
    </div>
  );
}