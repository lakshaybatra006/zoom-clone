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

function RemoteVideoTile({
  peer,
  reaction,
  isHost,
  onMuteParticipant,
  onRemoveParticipant,
}: {
  peer: RemotePeer;
  reaction?: ActiveReaction;
  isHost: boolean;
  onMuteParticipant: (name: string) => void;
  onRemoveParticipant: (name: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioBlocked, setAudioBlocked] = useState<boolean>(false);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play().catch(() => setAudioBlocked(true));
    }
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
      audioRef.current.play().catch(() => setAudioBlocked(true));
    }
  }, [peer.stream]);

  const handleEnableAudio = () => {
    if (videoRef.current) videoRef.current.play().catch(() => {});
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setAudioBlocked(false);
  };

  return (
    <div className="relative group w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <audio ref={audioRef} autoPlay playsInline />

      {audioBlocked && (
        <button
          onClick={handleEnableAudio}
          className="absolute inset-0 m-auto w-max h-max bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2.5 rounded-xl font-semibold shadow-2xl z-30 animate-pulse border border-blue-400/50"
        >
          🔊 Tap to Unmute Remote Audio
        </button>
      )}

      {/* PARTICIPANT LABEL */}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 z-10">
        <span>{peer.name}</span>
      </div>

      {/* HOST ACTION OVERLAY BUTTONS (VISIBLE ON HOVER IF USER IS HOST) */}
      {isHost && (
        <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            onClick={() => onMuteParticipant(peer.name)}
            className="bg-black/70 hover:bg-amber-600/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md transition"
            title="Force Mute Mic"
          >
            Mute
          </button>
          <button
            onClick={() => onRemoveParticipant(peer.name)}
            className="bg-black/70 hover:bg-red-600/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md transition"
            title="Remove from meeting"
          >
            Remove
          </button>
        </div>
      )}

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
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [localStreamReady, setLocalStreamReady] = useState<boolean>(false);

  const [activeSidebar, setActiveSidebar] = useState<'none' | 'participants' | 'chat'>('none');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  const [admittedParticipants, setAdmittedParticipants] = useState<Participant[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
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

        // FORCE MUTE SIGNAL FOR THIS USER
        if (type === 'mute_participant' && target === userName) {
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = false;
              setMicOn(false);
            }
          }
          return;
        }

        // KICK / REMOVE SIGNAL FOR THIS USER
        if (type === 'kick_participant' && target === userName) {
          alert('You have been removed from the meeting by the host.');
          handleEndMeeting();
          return;
        }

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

  // HOST ACTION HANDLERS
  const handleMuteParticipant = (targetName: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'mute_participant',
        sender: userName,
        target: targetName,
      })
    );
  };

  const handleRemoveParticipant = (targetName: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'kick_participant',
        sender: userName,
        target: targetName,
      })
    );
    removePeerConnection(targetName);
  };

  const handleAdmitParticipant = async (participantId: string) => {
    try {
      await fetch(`${API_BASE}/api/meetings/${roomId}/admit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: participantId }),
      });
    } catch (e) {}
  };

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

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
      } catch (err) {
        console.error('Screen sharing canceled/error:', err);
      }
    }
  };

  const sendEmojiReaction = (emoji: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'reaction',
          sender: userName,
          emoji: emoji,
        })
      );
    }
    setShowEmojiPicker(false);
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgData: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: userName,
      text: chatInput,
      time: timeStr,
      isSelf: true,
    };

    setChatMessages((prev) => [...prev, msgData]);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'chat',
          sender: userName,
          text: chatInput,
          time: timeStr,
        })
      );
    }
    setChatInput('');
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
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((t) => t.stop());
    Object.values(peerConnections.current).forEach((pc) => pc.close());

    router.push('/');
  };

  const handleGuestSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) setHasSubmittedName(true);
  };

  return (
    <div className="relative h-screen w-screen bg-[#000000] text-white flex flex-col justify-between select-none overflow-hidden font-sans">
      {!hasSubmittedName && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#16191e] border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-white">Join Meeting</h2>
            <p className="text-sm text-slate-400 mb-6">
              Enter display name for room <span className="font-mono text-blue-400">{roomId || '...'}</span>.
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

      {/* MAIN VIDEO AREA */}
      <main className="flex-1 relative flex items-center justify-center p-3 overflow-hidden">
        <div className="w-full h-full max-w-7xl grid gap-3 items-center justify-center grid-cols-1 md:grid-cols-2">
          {/* LOCAL USER TILE */}
          <div className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
            {camOn ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="-scale-x-100 w-full h-full object-cover" />
            ) : (
              <div className="text-slate-400 text-sm font-medium">Camera is turned off</div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 border border-white/10 z-10">
              {userName} {isHost ? '(Host, You)' : '(You)'}
            </div>
          </div>

          {/* REMOTE PARTICIPANTS */}
          {admittedParticipants
            .filter((p) => p.name !== userName && p.id !== myParticipantId)
            .map((p) => {
              const peer = remotePeers.find((peer) => peer.name === p.name || peer.peerId === p.name);
              if (peer && peer.stream) {
                return (
                  <RemoteVideoTile
                    key={p.id || p.name}
                    peer={peer}
                    isHost={isHost}
                    onMuteParticipant={handleMuteParticipant}
                    onRemoveParticipant={handleRemoveParticipant}
                  />
                );
              }
              return (
                <div key={p.id || p.name} className="relative w-full h-full min-h-[300px] bg-[#12151b] border border-slate-800/80 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                  Connecting to {p.name}...
                </div>
              );
            })}
        </div>

        {/* SIDEBAR OVERLAY: PARTICIPANTS */}
        {activeSidebar === 'participants' && (
          <aside className="absolute right-3 top-3 bottom-3 w-80 bg-[#16191e] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between z-30 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-bold text-sm text-white">Participants ({admittedParticipants.length})</h3>
                <button onClick={() => setActiveSidebar('none')} className="text-slate-400 hover:text-white text-xs">✕</button>
              </div>

              {/* WAITING ROOM LIST (HOST ONLY) */}
              {isHost && waitingParticipants.length > 0 && (
                <div className="mt-4 pb-3 border-b border-slate-800">
                  <h4 className="text-xs font-semibold text-amber-400 mb-2">Waiting Room ({waitingParticipants.length})</h4>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {waitingParticipants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-[#1f242d] p-2 rounded-lg text-xs">
                        <span className="text-slate-200">{p.name}</span>
                        <button
                          onClick={() => handleAdmitParticipant(p.id)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2.5 py-1 rounded-md font-semibold"
                        >
                          Admit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ADMITTED PARTICIPANTS ROSTER WITH MUTE / REMOVE */}
              <div className="mt-4 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {admittedParticipants.map((p) => (
                  <div key={p.id || p.name} className="flex items-center justify-between bg-[#12151b] p-2.5 rounded-xl text-xs border border-slate-800/60">
                    <span className="text-slate-200 font-medium">
                      {p.name} {p.name === userName ? '(You)' : ''} {p.is_host ? '(Host)' : ''}
                    </span>

                    {/* HOST ACTION BUTTONS */}
                    {isHost && p.name !== userName && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleMuteParticipant(p.name)}
                          className="bg-slate-800 hover:bg-amber-600 text-slate-200 hover:text-white px-2 py-1 rounded-md text-[10px] transition"
                        >
                          Mute
                        </button>
                        <button
                          onClick={() => handleRemoveParticipant(p.name)}
                          className="bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white px-2 py-1 rounded-md text-[10px] transition"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* SIDEBAR OVERLAY: CHAT */}
        {activeSidebar === 'chat' && (
          <aside className="absolute right-3 top-3 bottom-3 w-80 bg-[#16191e] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between z-30 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">In-Meeting Chat</h3>
              <button onClick={() => setActiveSidebar('none')} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="flex-1 my-3 overflow-y-auto space-y-3 pr-1">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-0.5">{msg.sender} • {msg.time}</span>
                  <div className={`px-3 py-2 rounded-xl text-xs max-w-[85%] ${msg.isSelf ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={sendChatMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#0d0f12] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl text-xs font-semibold">Send</button>
            </form>
          </aside>
        )}
      </main>

      {/* BOTTOM CONTROL TOOLBAR (MATCHING YOUR SCREENSHOT EXACTLY) */}
      <footer className="h-16 bg-[#0f1115] border-t border-slate-800/80 px-6 flex items-center justify-between z-20">
        {/* LEFT: ZOOM LOGO BRANDING */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xs">📹</div>
          <span className="font-semibold text-sm text-white tracking-wide">Zoom</span>
        </div>

        {/* CENTER: MEDIA CONTROLS & END MEETING */}
        <div className="flex items-center gap-3 relative">
          {/* MIC TOGGLE */}
          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${micOn ? 'bg-[#222731] hover:bg-slate-700 text-white' : 'bg-red-600/20 text-red-500 border border-red-500/30'}`}
            title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micOn ? '🎙️' : '🔇'}
          </button>

          {/* CAMERA TOGGLE */}
          <button
            onClick={toggleCam}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${camOn ? 'bg-[#222731] hover:bg-slate-700 text-white' : 'bg-red-600/20 text-red-500 border border-red-500/30'}`}
            title={camOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {camOn ? '📹' : '🚫'}
          </button>

          {/* SCREEN SHARE */}
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isScreenSharing ? 'bg-green-600 text-white' : 'bg-[#222731] hover:bg-slate-700 text-white'}`}
            title="Share Screen"
          >
            🖥️
          </button>

          {/* EMOJI REACTION PICKER */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-10 h-10 rounded-full bg-[#222731] hover:bg-slate-700 flex items-center justify-center text-white transition"
              title="Reactions"
            >
              😊
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#16191e] border border-slate-800 p-2 rounded-2xl flex gap-2 shadow-2xl z-40">
                {['👍', '👏', '❤️', '😂', '🎉', '🔥'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendEmojiReaction(emoji)}
                    className="p-2 hover:bg-slate-800 rounded-xl text-xl transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* END MEETING BUTTON */}
          <button
            onClick={handleEndMeeting}
            className="ml-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-full shadow-lg transition"
          >
            End Meeting
          </button>
        </div>

        {/* RIGHT: CHAT & PARTICIPANTS PANELS TOGGLE */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveSidebar(activeSidebar === 'chat' ? 'none' : 'chat');
              setUnreadChatCount(0);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center relative transition ${activeSidebar === 'chat' ? 'bg-blue-600 text-white' : 'bg-[#222731] hover:bg-slate-700 text-white'}`}
            title="Chat"
          >
            💬
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {unreadChatCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSidebar(activeSidebar === 'participants' ? 'none' : 'participants')}
            className={`w-10 h-10 rounded-full flex items-center justify-center relative transition ${activeSidebar === 'participants' ? 'bg-blue-600 text-white' : 'bg-[#222731] hover:bg-slate-700 text-white'}`}
            title="Participants"
          >
            👥
            {waitingParticipants.length > 0 && isHost && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">
                !
              </span>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}