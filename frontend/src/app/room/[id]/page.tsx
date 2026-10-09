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

// Remote Participant Video Tile Component
function RemoteVideoTile({ peer, reaction }: { peer: RemotePeer; reaction?: ActiveReaction }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && peer.stream) {
      videoEl.srcObject = peer.stream;
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Autoplay interaction needed for remote stream:', err);
        });
      }
    }
  }, [peer.stream]);

  return (
    <div className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 flex items-center gap-2">
        <span>{peer.name}</span>
      </div>

      {/* REACTION OVERLAY */}
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

  // Room & User State
  const [roomId, setRoomId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [hasSubmittedName, setHasSubmittedName] = useState<boolean>(false);

  // Host vs Guest State
  const [isHost, setIsHost] = useState<boolean>(false);
  const [myStatus, setMyStatus] = useState<'admitted' | 'waiting'>('waiting');
  const [myParticipantId, setMyParticipantId] = useState<string>('');
  const [hostName, setHostName] = useState<string>('');

  // Control States
  const [micOn, setMicOn] = useState<boolean>(true);
  const [camOn, setCamOn] = useState<boolean>(true);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [localStreamReady, setLocalStreamReady] = useState<boolean>(false);

  // Sidebar Panel State: 'none' | 'participants' | 'chat'
  const [activeSidebar, setActiveSidebar] = useState<'none' | 'participants' | 'chat'>('none');

  // Emojis / Reactions State
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Participants & WebRTC Remote Peers State
  const [admittedParticipants, setAdmittedParticipants] = useState<Participant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const iceCandidatesQueue = useRef<{ [key: string]: RTCIceCandidateInit[] }>({});
  const socketRef = useRef<WebSocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Helper function to cleanly remove a peer connection and media stream
  const removePeerConnection = (peerName: string) => {
    if (peerConnections.current[peerName]) {
      peerConnections.current[peerName].close();
      delete peerConnections.current[peerName];
    }
    delete iceCandidatesQueue.current[peerName];

    setRemotePeers((prev) => prev.filter((p) => p.peerId !== peerName && p.name !== peerName));
    setAdmittedParticipants((prev) => prev.filter((p) => p.name !== peerName && p.id !== peerName));
  };

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

  // 3. Tab Close / Refresh Departure Handling (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'leave',
          sender: userName,
          participantId: myParticipantId,
        }));
      }

      if (roomId && myParticipantId) {
        navigator.sendBeacon(
          `${API_BASE}/api/meetings/${roomId}/leave`,
          JSON.stringify({ participant_id: myParticipantId })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, myParticipantId, userName]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeSidebar === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadChatCount(0);
    }
  }, [chatMessages, activeSidebar]);

  // 4. Register user with room backend
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

  // 5. Initialize Local Camera & Microphone Stream
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
        setLocalStreamReady(true);
      } catch (err) {
        console.error('Error accessing camera/microphone:', err);
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

  // 6. Real-Time WebRTC Peer Connection & Signaling Setup
  useEffect(() => {
    if (myStatus !== 'admitted' || !roomId || !userName || !localStreamReady) return;

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
        const { type, sender, target, offer, answer, candidate, text, time, emoji } = msg;

        if (sender === userName) return;
        if (target && target !== userName) return;

        // Handle Participant Leaving Event
        if (type === 'leave' || type === 'user_left') {
          removePeerConnection(sender);
          return;
        }

        if (type === 'join') {
          createPeerConnection(sender, true);
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
          if (activeSidebar !== 'chat') {
            setUnreadChatCount((prev) => prev + 1);
          }
        } else if (type === 'reaction') {
          const reactionId = 'react-' + Date.now();
          setActiveReactions((prev) => [...prev, { id: reactionId, sender, emoji }]);
          setTimeout(() => {
            setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
          }, 3500);
        }
      } catch (e) {
        console.error('Signaling Error:', e);
      }
    };

    function createPeerConnection(peerName: string, isInitiator: boolean): RTCPeerConnection {
      if (peerConnections.current[peerName]) {
        return peerConnections.current[peerName];
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current[peerName] = pc;

      // Detect connection state drops and clean up tile immediately
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          removePeerConnection(peerName);
        }
      };

      const activeStream = screenStreamRef.current || localStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => {
          pc.addTrack(track, activeStream);
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
            updated[existingIndex] = { ...existingPeer };
            return updated;
          } else {
            return [...prev, { peerId: peerName, name: peerName, stream: incomingStream }];
          }
        });
      };

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
  }, [myStatus, roomId, userName, myParticipantId, localStreamReady, activeSidebar]);

  // 7. Polling Room State & Automatic Cleanup for Disconnected Participants
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

          // Purge any remote peer tiles and streams whose names are no longer in admittedList
          const admittedNames = new Set(admittedList.map((p: Participant) => p.name));
          setRemotePeers((prev) => prev.filter((peer) => admittedNames.has(peer.name) || admittedNames.has(peer.peerId)));

          if (myParticipantId) {
            const meInAdmitted = admittedList.find((p: Participant) => p.id === myParticipantId || p.name === userName);
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

  // Screen Share Toggle
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        Object.values(peerConnections.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenVideoTrack);
          }
        });

        setIsScreenSharing(true);

        screenVideoTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      const cameraVideoTrack = localStreamRef.current.getVideoTracks()[0];

      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && cameraVideoTrack) {
          sender.replaceTrack(cameraVideoTrack);
        }
      });
    }

    setIsScreenSharing(false);
  };

  // Emoji Reactions
  const sendEmojiReaction = (emoji: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'reaction',
        sender: userName,
        emoji: emoji,
      }));
    }

    const reactionId = 'react-' + Date.now();
    setActiveReactions((prev) => [...prev, { id: reactionId, sender: userName, emoji }]);
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 3500);

    setShowEmojiPicker(false);
  };

  // Chat
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        sender: userName,
        text: chatInput.trim(),
        time: timeStr,
      }));
    }

    setChatMessages((prev) => [
      ...prev,
      {
        id: 'msg-' + Date.now(),
        sender: userName,
        text: chatInput.trim(),
        time: timeStr,
        isSelf: true,
      },
    ]);

    setChatInput('');
  };

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

  // Controls
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
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // End / Leave Meeting Handler
  const handleEndMeeting = async () => {
    // 1. Broadcast WebSocket leave message
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'leave',
        sender: userName,
        participantId: myParticipantId,
      }));
    }

    // 2. Call Backend API to remove participant from database state
    if (roomId && myParticipantId) {
      try {
        await fetch(`${API_BASE}/api/meetings/${roomId}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant_id: myParticipantId }),
        });
      } catch (e) {}
    }

    // 3. Stop local tracks & peer connections
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};

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
      
      {/* 1. GUEST DISPLAY NAME MODAL */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium">Copy Link</span>
            </>
          )}
        </button>
      </header>

      {/* MAIN VIDEO GRID & SIDEBAR PANELS */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex items-center justify-center p-4">
          <div className={`w-full max-w-6xl h-full grid gap-4 items-center justify-center ${
            admittedParticipants.filter((p) => p.name !== userName && p.id !== myParticipantId).length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}>
            
            {/* LOCAL USER TILE (YOU) */}
            <div className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
              {camOn || isScreenSharing ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isScreenSharing ? '' : '-scale-x-100'}`}
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
                <span>{userName || 'Guest'} {isHost ? '(Host, You)' : '(You)'} {isScreenSharing ? '[Screen]' : ''}</span>
                {!micOn && (
                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                  </svg>
                )}
              </div>

              {/* LOCAL REACTION ANIMATION */}
              {activeReactions.filter((r) => r.sender === userName).length > 0 && (
                <div className="absolute top-6 right-6 bg-black/70 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl text-3xl animate-bounce shadow-2xl z-20">
                  {activeReactions.filter((r) => r.sender === userName).slice(-1)[0]?.emoji}
                </div>
              )}
            </div>

            {/* ADMITTED OTHER PARTICIPANTS TILES */}
            {admittedParticipants
              .filter((p) => p.name !== userName && p.id !== myParticipantId)
              .map((p) => {
                const peer = remotePeers.find((peer) => peer.name === p.name || peer.peerId === p.name);
                const reaction = activeReactions.filter((r) => r.sender === p.name).slice(-1)[0];

                if (peer && peer.stream) {
                  return (
                    <RemoteVideoTile
                      key={p.id || p.name}
                      peer={peer}
                      reaction={reaction}
                    />
                  );
                }

                return (
                  <div
                    key={p.id || p.name}
                    className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center gap-3"
                  >
                    <div className="w-20 h-20 rounded-full bg-blue-600 border border-blue-500/50 flex items-center justify-center text-2xl font-bold text-white shadow-lg animate-pulse">
                      {p.name ? p.name.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <span className="text-sm font-semibold text-slate-300">{p.name}</span>
                    <span className="text-xs text-slate-500">Connecting video stream...</span>

                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 flex items-center gap-2">
                      <span>{p.name} {p.is_host ? '(Host)' : ''}</span>
                    </div>

                    {reaction && (
                      <div className="absolute top-6 right-6 bg-black/70 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl text-3xl animate-bounce shadow-2xl z-20">
                        {reaction.emoji}
                      </div>
                    )}
                  </div>
                );
              })}

          </div>
        </main>

        {/* SIDEBAR PANEL 1: PARTICIPANTS */}
        {activeSidebar === 'participants' && (
          <aside className="w-80 bg-[#16191e] border-l border-slate-800/80 p-4 flex flex-col justify-between z-30">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Participants</span>
                  <span className="bg-blue-600/30 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">
                    {admittedParticipants.length}
                  </span>
                </h3>
                <button onClick={() => setActiveSidebar('none')} className="text-slate-400 hover:text-white p-1">
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
              <span>Invite Participants</span>
            </button>
          </aside>
        )}

        {/* SIDEBAR PANEL 2: LIVE IN-MEETING CHAT */}
        {activeSidebar === 'chat' && (
          <aside className="w-80 bg-[#16191e] border-l border-slate-800/80 p-4 flex flex-col justify-between z-30">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">In-Meeting Chat</h3>
              <button onClick={() => setActiveSidebar('none')} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="flex-1 my-4 overflow-y-auto space-y-3 pr-1 max-h-[calc(100vh-220px)]">
              {chatMessages.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-10">No messages yet. Send a chat to everyone!</div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[11px] font-semibold text-slate-300">{msg.sender}</span>
                      <span className="text-[9px] text-slate-500">{msg.time}</span>
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                        msg.isSelf
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : 'bg-[#0d0f12] text-slate-200 border border-slate-800 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendChatMessage} className="pt-2 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#0d0f12] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition"
              >
                Send
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* BOTTOM CONTROLS TOOLBAR */}
      <footer className="p-4 bg-[#12151b]/90 border-t border-slate-800/80 backdrop-blur-lg flex items-center justify-between z-10 relative">
        <div className="hidden md:flex items-center gap-2">
          <div className="bg-blue-600 text-white p-1 rounded">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.5 4.5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-3.586l3.293 3.293a1 1 0 001.414-1.414v-9.586a1 1 0 00-1.414-1.414L17.5 8.086V6.5a2 2 0 00-2-2h-11z" />
            </svg>
          </div>
          <span className="text-xs font-bold tracking-tight text-slate-300">Zoom</span>
        </div>

        {/* CENTER TOOLBAR BUTTONS */}
        <div className="flex items-center gap-3 md:gap-4 relative">
          
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              micOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-500/20 text-red-500 border border-red-500/30'
            }`}
            title={micOn ? 'Mute Mic' : 'Unmute Mic'}
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
            title={camOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg ${
              isScreenSharing ? 'bg-emerald-600 text-white border-2 border-emerald-400' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition shadow-lg text-lg"
              title="Reactions"
            >
              😊
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#16191e] border border-slate-700 p-2 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in zoom-in duration-150">
                {['👍', '❤️', '👏', '😂', '🎉', '🔥', '👋', '😮'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendEmojiReaction(emoji)}
                    className="p-2 hover:bg-slate-800 rounded-xl text-xl transition transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleEndMeeting}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full flex items-center gap-2 transition shadow-lg shadow-red-600/30"
          >
            <span>End Meeting</span>
          </button>
        </div>

        {/* RIGHT SIDEBAR TOGGLES */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveSidebar(activeSidebar === 'chat' ? 'none' : 'chat');
              setUnreadChatCount(0);
            }}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition ${
              activeSidebar === 'chat' ? 'bg-blue-600 text-white' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
            title="Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSidebar(activeSidebar === 'participants' ? 'none' : 'participants')}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition ${
              activeSidebar === 'participants' ? 'bg-blue-600 text-white' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
            title="Participants"
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
        </div>
      </footer>
    </div>
  );
}