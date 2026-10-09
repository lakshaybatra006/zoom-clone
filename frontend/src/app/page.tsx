'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://zoom-clone-4-zp2h.onrender.com";

export default function HomePage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  // Default ALWAYS to landing page on initial site visit
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>('landing');
  
  // Dashboard Navigation Tab State: 'home' | 'meetings' | 'settings'
  const [activeTab, setActiveTab] = useState<'home' | 'meetings' | 'settings'>('home');

  // Auth Modal States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  // Join Room Modal State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');

  // Settings Preferences States
  const [defaultMicOn, setDefaultMicOn] = useState(true);
  const [defaultCamOn, setDefaultCamOn] = useState(true);
  const [enableWaitingRoom, setEnableWaitingRoom] = useState(true);
  const [hdVideo, setHdVideo] = useState(true);
  const [savedSettingsToast, setSavedSettingsToast] = useState(false);

  // Load saved user session and settings on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('zoom_clone_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          setCurrentUser(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }

    const savedSettings = localStorage.getItem('zoom_clone_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setDefaultMicOn(parsed.defaultMicOn ?? true);
        setDefaultCamOn(parsed.defaultCamOn ?? true);
        setEnableWaitingRoom(parsed.enableWaitingRoom ?? true);
        setHdVideo(parsed.hdVideo ?? true);
      } catch (e) {}
    }
  }, []);

  // Handle Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    const payload = authMode === 'login'
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, name: authName };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      setCurrentUser(data);
      localStorage.setItem('zoom_clone_user', JSON.stringify(data));
      setShowAuthModal(false);
      setViewMode('dashboard');
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('zoom_clone_user');
    setCurrentUser(null);
    setViewMode('landing');
    setActiveTab('home');
  };

  // Handle Starting Instant Meeting
  const handleStartInstantMeeting = async () => {
    const fallbackId = Math.random().toString(36).substring(2, 8);
    try {
      const res = await fetch(`${API_BASE}/api/meetings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Instant Meeting",
          host_id: currentUser?.id || "guest",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newRoomId = data.meeting_id || data.id || fallbackId;
        router.push(`/room/${newRoomId}?host=true`);
      } else {
        router.push(`/room/${fallbackId}?host=true`);
      }
    } catch (err) {
      router.push(`/room/${fallbackId}?host=true`);
    }
  };

  // Handle Joining Meeting
  const handleJoinMeetingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinRoomId.trim()) {
      router.push(`/room/${joinRoomId.trim()}`);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const settings = { defaultMicOn, defaultCamOn, enableWaitingRoom, hdVideo };
    localStorage.setItem('zoom_clone_settings', JSON.stringify(settings));
    setSavedSettingsToast(true);
    setTimeout(() => setSavedSettingsToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. MARKETING LANDING PAGE VIEW */}
      {viewMode === 'landing' && (
        <div className="min-h-screen flex flex-col">
          {/* NAVBAR */}
          <nav className="border-b border-slate-800/80 bg-[#07090e]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 select-none">
                <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.5 4.5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-3.586l3.293 3.293a1 1 0 001.414-1.414v-9.586a1 1 0 00-1.414-1.414L17.5 8.086V6.5a2 2 0 00-2-2h-11z" />
                  </svg>
                </div>
                <span className="text-2xl font-bold tracking-tight text-white">zoom</span>
              </div>

              <div className="hidden md:flex items-center gap-6 text-sm text-slate-300 font-medium">
                <span className="hover:text-white cursor-pointer transition">Products</span>
                <span className="hover:text-white cursor-pointer transition">Solutions</span>
                <span className="hover:text-white cursor-pointer transition">Pricing</span>
                <span className="hover:text-white cursor-pointer transition">Support</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <button
                    onClick={() => setViewMode('dashboard')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition"
                  >
                    Go to Dashboard
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-slate-800 hover:bg-red-600/80 text-slate-200 rounded-lg text-sm font-medium transition"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition"
                  >
                    Sign Up Free
                  </button>
                </>
              )}
            </div>
          </nav>

          {/* ANNOUNCEMENT BANNER */}
          <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-blue-950 border-b border-blue-800/40 py-2.5 px-4 text-center text-xs md:text-sm text-blue-200 flex items-center justify-center gap-2">
            <span>AI, CX, and beyond — Zoomtopia 2026 sessions are live!</span>
            <button 
              onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-0.5 rounded-full text-xs transition"
            >
              Register now
            </button>
          </div>

          {/* HERO SECTION */}
          <section className="relative px-6 pt-20 pb-24 max-w-6xl mx-auto text-center flex flex-col items-center flex-1">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-4xl">
              Find out what's possible when work connects
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mb-10 leading-relaxed">
              Bridge the gap between talking and doing with the AI-first work platform built for seamless online collaboration.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => {
                  if (currentUser) {
                    handleStartInstantMeeting();
                  } else {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }
                }}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-base shadow-xl shadow-blue-600/25 transition"
              >
                Start Instant Meeting
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-8 py-3.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl text-base transition"
              >
                Join a Meeting
              </button>
            </div>

            {/* FEATURE CARDS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mt-20 text-left">
              <div className="bg-[#0f141f] border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 transition group">
                <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 text-blue-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Meetings</h3>
                <p className="text-sm text-slate-400">HD video & audio calls with active noise suppression and screen sharing.</p>
              </div>

              <div className="bg-[#0f141f] border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 transition group">
                <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 text-blue-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Team Chat</h3>
                <p className="text-sm text-slate-400">Continuous group messaging, media sharing, and channel workspaces.</p>
              </div>

              <div className="bg-[#0f141f] border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 transition group">
                <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 text-blue-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Scheduler</h3>
                <p className="text-sm text-slate-400">Seamlessly schedule upcoming meetings and sync calendar invitations.</p>
              </div>

              <div className="bg-[#0f141f] border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 transition group">
                <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 text-blue-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Security</h3>
                <p className="text-sm text-slate-400">Enterprise-grade encryption with PostgreSQL persistence on Neon Cloud.</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. DASHBOARD VIEW (INTERACTIVE SIDEBAR & TABS) */}
      {viewMode === 'dashboard' && (
        <div className="flex h-screen bg-[#11141b] text-white overflow-hidden">
          {/* SIDEBAR */}
          <aside className="w-64 bg-[#181c26] border-r border-slate-800 flex flex-col justify-between p-4">
            <div>
              {/* BRANDING */}
              <div 
                onClick={() => setViewMode('landing')}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer mb-6"
              >
                <div className="bg-blue-600 text-white p-1 rounded">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.5 4.5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-3.586l3.293 3.293a1 1 0 001.414-1.414v-9.586a1 1 0 00-1.414-1.414L17.5 8.086V6.5a2 2 0 00-2-2h-11z" />
                  </svg>
                </div>
                <span className="text-xl font-bold tracking-tight">zoom</span>
              </div>

              {/* NAVIGATION MENU BUTTONS */}
              <nav className="space-y-1">
                {/* HOME TAB */}
                <button 
                  onClick={() => setActiveTab('home')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
                    activeTab === 'home'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>Home</span>
                </button>

                {/* MEETINGS TAB */}
                <button 
                  onClick={() => setActiveTab('meetings')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
                    activeTab === 'meetings'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span>Meetings</span>
                </button>

                {/* SETTINGS TAB */}
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
                    activeTab === 'settings'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                  <span>Settings</span>
                </button>
              </nav>
            </div>

            {/* LOGGED IN USER FOOTER */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 font-bold flex items-center justify-center text-white text-sm">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="overflow-hidden">
                  <div className="font-semibold text-sm truncate">{currentUser?.name || 'User'}</div>
                  <div className="text-xs text-slate-400 truncate">{currentUser?.email || ''}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  onClick={() => setViewMode('landing')}
                  className="text-slate-400 hover:text-white transition"
                >
                  Landing Page
                </button>
                <button
                  onClick={handleLogout}
                  className="text-red-400 hover:text-red-300 font-medium transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* MAIN TAB CONTENT AREA */}
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto">

              {/* TAB 1: HOME */}
              {activeTab === 'home' && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold">Welcome back, {currentUser?.name || 'User'}</h2>
                    <p className="text-sm text-slate-400">Start or join a meeting instantly from your dashboard.</p>
                  </div>

                  {/* ACTION GRID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <button
                      onClick={handleStartInstantMeeting}
                      className="bg-orange-600 hover:bg-orange-500 text-white p-8 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-xl transition"
                    >
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <span className="font-bold text-lg">New Meeting</span>
                    </button>

                    <button
                      onClick={() => setShowJoinModal(true)}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-8 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-xl transition"
                    >
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      <span className="font-bold text-lg">Join</span>
                    </button>

                    <button 
                      onClick={() => setActiveTab('meetings')}
                      className="bg-[#181c26] hover:bg-slate-800 border border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition"
                    >
                      <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="font-bold text-lg text-slate-200">Schedule</span>
                    </button>

                    <button 
                      onClick={handleStartInstantMeeting}
                      className="bg-[#181c26] hover:bg-slate-800 border border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition"
                    >
                      <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      <span className="font-bold text-lg text-slate-200">Share Screen</span>
                    </button>
                  </div>

                  {/* UPCOMING MEETINGS */}
                  <div className="bg-[#181c26] border border-slate-800/80 rounded-2xl p-6 mb-6">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Upcoming Meetings
                    </h3>
                    <p className="text-xs text-slate-400 text-center py-6">No upcoming meetings scheduled.</p>
                  </div>

                  {/* RECENT MEETINGS */}
                  <div className="bg-[#181c26] border border-slate-800/80 rounded-2xl p-6">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Recent Meetings
                    </h3>
                    <p className="text-xs text-slate-400 text-center py-6">No recent meetings found.</p>
                  </div>
                </div>
              )}

              {/* TAB 2: MEETINGS */}
              {activeTab === 'meetings' && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold">Meetings & Personal Room</h2>
                    <p className="text-sm text-slate-400">Manage your Personal Meeting ID and scheduled events.</p>
                  </div>

                  {/* PERSONAL ROOM CARD */}
                  <div className="bg-[#181c26] border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                      <div>
                        <div className="text-xs font-semibold text-blue-400 mb-1">PERSONAL MEETING ROOM</div>
                        <h3 className="text-xl font-bold text-white">{currentUser?.name}'s Personal Room</h3>
                        <p className="text-xs text-slate-400 mt-1 font-mono">
                          PMI: <span className="text-slate-200">839-402-9182</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleStartInstantMeeting}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-600/20"
                        >
                          Start Meeting
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/room/pmi-839402`);
                            alert("Personal Room link copied to clipboard!");
                          }}
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition"
                        >
                          Copy Invitation
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-xs text-slate-300">
                      <div>
                        <span className="text-slate-500 block mb-1">Passcode</span>
                        <span className="font-mono text-white">492018</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Waiting Room</span>
                        <span className="text-emerald-400 font-medium">Enabled</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Host Video</span>
                        <span className="text-slate-200">ON</span>
                      </div>
                    </div>
                  </div>

                  {/* SCHEDULED MEETINGS TABLE */}
                  <div className="bg-[#181c26] border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-lg text-white">Scheduled Meetings</h3>
                      <button
                        onClick={handleStartInstantMeeting}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg transition"
                      >
                        + Schedule New
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 bg-[#11141b] border border-slate-800/80 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-white">Weekly Team Sync</div>
                          <div className="text-xs text-slate-400 mt-0.5">Recurring | ID: <span className="font-mono text-slate-300">wks-9021</span></div>
                        </div>
                        <button
                          onClick={() => router.push('/room/wks-9021?host=true')}
                          className="px-4 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-semibold rounded-lg transition border border-blue-500/30"
                        >
                          Start
                        </button>
                      </div>

                      <div className="p-4 bg-[#11141b] border border-slate-800/80 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-white">Project Design Review</div>
                          <div className="text-xs text-slate-400 mt-0.5">Tomorrow at 4:00 PM | ID: <span className="font-mono text-slate-300">dsg-4412</span></div>
                        </div>
                        <button
                          onClick={() => router.push('/room/dsg-4412?host=true')}
                          className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition"
                        >
                          Start
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SETTINGS */}
              {activeTab === 'settings' && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold">Preferences & Settings</h2>
                    <p className="text-sm text-slate-400">Customize your account, camera, microphone, and meeting security settings.</p>
                  </div>

                  {savedSettingsToast && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl flex items-center justify-between">
                      <span>✓ Settings saved successfully!</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    {/* PROFILE INFO CARD */}
                    <div className="bg-[#181c26] border border-slate-800 rounded-2xl p-6">
                      <h3 className="font-bold text-base text-white mb-4 border-b border-slate-800 pb-3">Profile Details</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Display Name</label>
                          <input
                            type="text"
                            disabled
                            value={currentUser?.name || 'Guest User'}
                            className="w-full px-4 py-2.5 bg-[#11141b] border border-slate-700 rounded-lg text-slate-300 text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                          <input
                            type="text"
                            disabled
                            value={currentUser?.email || 'guest@zoomclone.com'}
                            className="w-full px-4 py-2.5 bg-[#11141b] border border-slate-700 rounded-lg text-slate-300 text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* AUDIO & VIDEO PREFERENCES */}
                    <div className="bg-[#181c26] border border-slate-800 rounded-2xl p-6 space-y-4">
                      <h3 className="font-bold text-base text-white border-b border-slate-800 pb-3">Audio & Video Defaults</h3>
                      
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-semibold text-sm text-white">Microphone On by Default</div>
                          <div className="text-xs text-slate-400">Automatically unmute microphone when joining a meeting.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={defaultMicOn}
                          onChange={(e) => setDefaultMicOn(e.target.checked)}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-slate-800/80">
                        <div>
                          <div className="font-semibold text-sm text-white">Camera On by Default</div>
                          <div className="text-xs text-slate-400">Turn on camera video when entering a room.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={defaultCamOn}
                          onChange={(e) => setDefaultCamOn(e.target.checked)}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between py-2 border-t border-slate-800/80">
                        <div>
                          <div className="font-semibold text-sm text-white">HD Video Capture</div>
                          <div className="text-xs text-slate-400">Enable high-definition 720p/1080p video stream resolution.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={hdVideo}
                          onChange={(e) => setHdVideo(e.target.checked)}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* SECURITY & WAITING ROOM */}
                    <div className="bg-[#181c26] border border-slate-800 rounded-2xl p-6 space-y-4">
                      <h3 className="font-bold text-base text-white border-b border-slate-800 pb-3">Security Controls</h3>

                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="font-semibold text-sm text-white">Enable Waiting Room by Default</div>
                          <div className="text-xs text-slate-400">Require host approval before participants enter meetings you host.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={enableWaitingRoom}
                          onChange={(e) => setEnableWaitingRoom(e.target.checked)}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-semibold text-white rounded-xl text-sm transition shadow-lg shadow-blue-600/20"
                    >
                      Save Preferences
                    </button>
                  </form>
                </div>
              )}

            </div>
          </main>
        </div>
      )}

      {/* AUTH MODAL (SIGN IN / SIGN UP) */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#121620] border border-slate-800 p-8 rounded-2xl max-w-md w-full relative shadow-2xl">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-2">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {authMode === 'login' 
                ? 'Enter your credentials to access your dashboard.' 
                : 'Sign up to host instant meetings and schedule events.'}
            </p>

            {authError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#080a0f] border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-white text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#080a0f] border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#080a0f] border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-white text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg text-sm transition shadow-lg shadow-blue-600/20"
              >
                {authMode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              {authMode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                    className="text-blue-400 hover:underline font-semibold"
                  >
                    Sign Up Free
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    onClick={() => { setAuthMode('login'); setAuthError(''); }}
                    className="text-blue-400 hover:underline font-semibold"
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JOIN MEETING MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#121620] border border-slate-800 p-8 rounded-2xl max-w-md w-full relative shadow-2xl">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-2">Join Meeting</h2>
            <p className="text-xs text-slate-400 mb-6">Enter the 6-character Meeting ID or Room code.</p>

            <form onSubmit={handleJoinMeetingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Meeting ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. x7a9b2"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#080a0f] border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-white text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg text-sm transition shadow-lg shadow-blue-600/20"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}