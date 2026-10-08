'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Video, PlusSquare, Calendar, Share2, Clock, 
  Settings, Copy, Check, User, Shield, VideoOff, Mic,
  Menu, X, LogIn, LogOut, UserPlus
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'home' | 'meetings' | 'settings'>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  // Meeting State
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  const [joinId, setJoinId] = useState('');
  const [displayName, setDisplayName] = useState('Alex Morgan');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings State
  const [autoMute, setAutoMute] = useState(false);
  const [autoVideoOff, setAutoVideoOff] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('zoom_clone_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser(parsed);
      setDisplayName(parsed.name);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchMeetings(currentUser.id);
    } else {
      fetchMeetings("usr_default_01");
    }
  }, [currentUser]);

  const fetchMeetings = async (userId: string) => {
    try {
      const [upRes, recRes] = await Promise.all([
        fetch(`${API_BASE}/meetings/upcoming?user_id=${userId}`),
        fetch(`${API_BASE}/meetings/recent?user_id=${userId}`)
      ]);
      if (upRes.ok) setUpcoming(await upRes.json());
      if (recRes.ok) setRecent(await recRes.json());
    } catch (err) {
      console.error("API connection error", err);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup';
    const payload = authMode === 'login' 
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, name: authName };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Authentication failed");
      }
      const data = await res.json();
      setCurrentUser(data);
      setDisplayName(data.name);
      localStorage.setItem('zoom_clone_user', JSON.stringify(data));
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zoom_clone_user');
    setCurrentUser(null);
    setDisplayName('Alex Morgan');
  };

  const handleNewMeeting = async () => {
    const userId = currentUser ? currentUser.id : "usr_default_01";
    try {
      const res = await fetch(`${API_BASE}/meetings/instant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: userId, title: `${displayName}'s Instant Meeting` })
      });
      const data = await res.json();
      router.push(`/room/${data.meeting_id}?pwd=${data.passcode}&name=${encodeURIComponent(displayName)}&isHost=true`);
    } catch (err) {
      alert("Error starting meeting");
    }
  };

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/meetings/validate/${joinId}`);
      if (!res.ok) throw new Error("Meeting not found");
      const data = await res.json();
      router.push(`/room/${data.meeting_id}?pwd=${data.passcode}&name=${encodeURIComponent(displayName)}&isHost=false`);
    } catch (err: any) {
      alert(err.message || "Invalid Meeting ID");
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = currentUser ? currentUser.id : "usr_default_01";
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    try {
      const res = await fetch(`${API_BASE}/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_id: userId,
          title: scheduleTitle,
          scheduled_at: scheduledAt,
          duration_minutes: 30
        })
      });
      if (res.ok) {
        setShowScheduleModal(false);
        setScheduleTitle('');
        fetchMeetings(userId);
      }
    } catch (err) {
      alert("Failed to schedule meeting");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const NavItems = () => (
    <nav className="space-y-1">
      <button 
        onClick={() => { setActiveTab('home'); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
          activeTab === 'home' ? 'bg-zoom-navActive text-white' : 'text-zoom-textMuted hover:bg-zoom-cardDark hover:text-white'
        }`}
      >
        <Clock className={`w-5 h-5 ${activeTab === 'home' ? 'text-zoom-blue' : ''}`} />
        <span>Home</span>
      </button>

      <button 
        onClick={() => { setActiveTab('meetings'); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
          activeTab === 'meetings' ? 'bg-zoom-navActive text-white' : 'text-zoom-textMuted hover:bg-zoom-cardDark hover:text-white'
        }`}
      >
        <Calendar className={`w-5 h-5 ${activeTab === 'meetings' ? 'text-zoom-blue' : ''}`} />
        <span>Meetings</span>
      </button>

      <button 
        onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
          activeTab === 'settings' ? 'bg-zoom-navActive text-white' : 'text-zoom-textMuted hover:bg-zoom-cardDark hover:text-white'
        }`}
      >
        <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'text-zoom-blue' : ''}`} />
        <span>Settings</span>
      </button>
    </nav>
  );

  return (
    <div className="flex h-screen bg-zoom-bgDark text-white font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-zoom-sidebarDark border-r border-gray-800 flex-col justify-between p-4 select-none">
        <div>
          <div className="flex items-center gap-3 px-3 py-4 mb-6">
            <div className="bg-zoom-blue p-2 rounded-xl">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-wide">zoom</span>
          </div>

          <NavItems />
        </div>

        {/* User Card */}
        <div className="border-t border-gray-800 pt-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-zoom-blue flex items-center justify-center text-sm font-semibold shrink-0">
                {displayName.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-[10px] text-zoom-textMuted truncate">
                  {currentUser ? currentUser.email : 'Guest Mode'}
                </p>
              </div>
            </div>
          </div>

          {currentUser ? (
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          ) : (
            <button 
              onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-zoom-blue hover:bg-zoom-blueHover rounded font-medium transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In / Sign Up
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-zoom-sidebarDark border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="bg-zoom-blue p-1.5 rounded-lg">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg">zoom</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-300">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Sidebar Overlay Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/80 flex flex-col justify-between p-6 top-14">
            <div>
              <NavItems />
            </div>
            <div className="border-t border-gray-800 pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zoom-blue flex items-center justify-center font-bold">
                  {displayName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs text-zoom-textMuted">{currentUser ? currentUser.email : 'Guest Mode'}</p>
                </div>
              </div>
              {currentUser ? (
                <button onClick={handleLogout} className="w-full py-2 bg-red-600 rounded text-sm font-semibold">Sign Out</button>
              ) : (
                <button onClick={() => { setShowAuthModal(true); setIsMobileMenuOpen(false); }} className="w-full py-2 bg-zoom-blue rounded text-sm font-semibold">Sign In</button>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto space-y-8">

            {/* HOME TAB */}
            {activeTab === 'home' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <button 
                    onClick={handleNewMeeting}
                    className="flex flex-col items-center justify-center p-5 md:p-6 bg-zoom-orange hover:opacity-90 rounded-2xl transition shadow-lg aspect-square"
                  >
                    <Video className="w-10 h-10 md:w-12 md:h-12 mb-2 md:mb-3 text-white" />
                    <span className="font-semibold text-sm md:text-lg">New Meeting</span>
                  </button>

                  <button 
                    onClick={() => setShowJoinModal(true)}
                    className="flex flex-col items-center justify-center p-5 md:p-6 bg-zoom-blue hover:opacity-90 rounded-2xl transition shadow-lg aspect-square"
                  >
                    <PlusSquare className="w-10 h-10 md:w-12 md:h-12 mb-2 md:mb-3 text-white" />
                    <span className="font-semibold text-sm md:text-lg">Join</span>
                  </button>

                  <button 
                    onClick={() => setShowScheduleModal(true)}
                    className="flex flex-col items-center justify-center p-5 md:p-6 bg-zoom-blue hover:opacity-90 rounded-2xl transition shadow-lg aspect-square"
                  >
                    <Calendar className="w-10 h-10 md:w-12 md:h-12 mb-2 md:mb-3 text-white" />
                    <span className="font-semibold text-sm md:text-lg">Schedule</span>
                  </button>

                  <button 
                    onClick={() => alert("Screen Sharing Initialized")}
                    className="flex flex-col items-center justify-center p-5 md:p-6 bg-zoom-blue hover:opacity-90 rounded-2xl transition shadow-lg aspect-square"
                  >
                    <Share2 className="w-10 h-10 md:w-12 md:h-12 mb-2 md:mb-3 text-white" />
                    <span className="font-semibold text-sm md:text-lg">Share Screen</span>
                  </button>
                </div>

                <section className="bg-zoom-cardDark rounded-xl p-4 md:p-6 border border-gray-800">
                  <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-zoom-blue" />
                    Upcoming Meetings
                  </h2>
                  {upcoming.length === 0 ? (
                    <p className="text-zoom-textMuted text-sm py-4 text-center">No upcoming meetings scheduled.</p>
                  ) : (
                    <div className="space-y-3">
                      {upcoming.map((m) => (
                        <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zoom-bgDark rounded-lg border border-gray-800 gap-3">
                          <div>
                            <h3 className="font-semibold text-base">{m.title}</h3>
                            <p className="text-xs text-zoom-textMuted mt-1">
                              {new Date(m.scheduled_at).toLocaleString()} | ID: {m.meeting_id}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => copyToClipboard(m.invite_link, m.id)}
                              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
                            >
                              {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-green-400"/> : <Copy className="w-3.5 h-3.5"/>}
                              {copiedId === m.id ? "Copied" : "Copy Link"}
                            </button>
                            <button 
                              onClick={() => router.push(`/room/${m.meeting_id}?pwd=${m.passcode}&name=${encodeURIComponent(displayName)}&isHost=true`)}
                              className="px-4 py-1.5 text-xs bg-zoom-blue hover:bg-zoom-blueHover font-medium rounded"
                            >
                              Start
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-zoom-cardDark rounded-xl p-4 md:p-6 border border-gray-800">
                  <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-zoom-blue" />
                    Recent Meetings
                  </h2>
                  <div className="divide-y divide-gray-800">
                    {recent.length === 0 ? (
                      <p className="text-zoom-textMuted text-sm py-4 text-center">No recent meetings found.</p>
                    ) : (
                      recent.map((m) => (
                        <div key={m.id} className="py-3 flex justify-between items-center text-sm">
                          <div>
                            <p className="font-medium">{m.title}</p>
                            <p className="text-xs text-zoom-textMuted">ID: {m.meeting_id}</p>
                          </div>
                          <span className="text-xs text-zoom-textMuted">{new Date(m.created_at).toLocaleDateString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            )}

            {/* MEETINGS TAB */}
            {activeTab === 'meetings' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold">My Meetings</h1>
                    <p className="text-sm text-zoom-textMuted mt-1">Manage and launch your scheduled and previous meetings.</p>
                  </div>
                  <button 
                    onClick={() => setShowScheduleModal(true)}
                    className="px-4 py-2 bg-zoom-blue hover:bg-zoom-blueHover font-medium rounded-lg text-sm flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule New
                  </button>
                </div>

                <div className="bg-zoom-cardDark rounded-xl p-6 border border-gray-800">
                  <h2 className="text-lg font-bold mb-4 text-zoom-blue">Scheduled Meetings ({upcoming.length})</h2>
                  {upcoming.length === 0 ? (
                    <p className="text-zoom-textMuted text-sm py-6 text-center border border-dashed border-gray-800 rounded-lg">
                      No scheduled meetings available. Click "Schedule New" above to create one.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {upcoming.map((m) => (
                        <div key={m.id} className="p-4 bg-zoom-bgDark rounded-lg border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-base">{m.title}</h3>
                            <p className="text-xs text-zoom-textMuted mt-1">
                              Scheduled: <span className="text-gray-300">{new Date(m.scheduled_at).toLocaleString()}</span>
                            </p>
                            <p className="text-xs text-zoom-textMuted">
                              Meeting ID: <span className="font-mono text-gray-300">{m.meeting_id}</span> | Passcode: <span className="font-mono text-gray-300">{m.passcode}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => copyToClipboard(m.invite_link, m.id)}
                              className="px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-1.5"
                            >
                              {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-green-400"/> : <Copy className="w-3.5 h-3.5"/>}
                              {copiedId === m.id ? "Copied" : "Copy Link"}
                            </button>
                            <button 
                              onClick={() => router.push(`/room/${m.meeting_id}?pwd=${m.passcode}&name=${encodeURIComponent(displayName)}&isHost=true`)}
                              className="px-5 py-2 text-xs bg-zoom-blue hover:bg-zoom-blueHover font-medium rounded-lg"
                            >
                              Start Meeting
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold">Settings</h1>
                  <p className="text-sm text-zoom-textMuted mt-1">Configure your personal audio, video, and profile settings.</p>
                </div>

                <div className="bg-zoom-cardDark rounded-xl p-6 border border-gray-800 space-y-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 border-b border-gray-800 pb-3">
                    <User className="w-5 h-5 text-zoom-blue" />
                    Profile Preferences
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zoom-textMuted block mb-1">Display Name</label>
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-zoom-blue"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zoom-textMuted block mb-1">Account Email</label>
                      <input 
                        type="email" 
                        disabled
                        value={currentUser ? currentUser.email : 'alex.morgan@zoomclone.com'}
                        className="w-full px-3 py-2 bg-zoom-bgDark/50 border border-gray-800 text-gray-400 rounded-lg text-sm cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <h2 className="text-lg font-bold flex items-center gap-2 border-b border-gray-800 pb-3 pt-4">
                    <Shield className="w-5 h-5 text-zoom-blue" />
                    In-Meeting Defaults
                  </h2>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-3 bg-zoom-bgDark rounded-lg border border-gray-800 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Mic className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">Mute microphone when joining</p>
                          <p className="text-xs text-zoom-textMuted">Automatically disable your microphone upon entering a room.</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={autoMute} 
                        onChange={(e) => setAutoMute(e.target.checked)}
                        className="w-4 h-4 accent-zoom-blue rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-zoom-bgDark rounded-lg border border-gray-800 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <VideoOff className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">Turn off camera when joining</p>
                          <p className="text-xs text-zoom-textMuted">Keep video camera disabled until manually toggled inside room.</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={autoVideoOff} 
                        onChange={(e) => setAutoVideoOff(e.target.checked)}
                        className="w-4 h-4 accent-zoom-blue rounded"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zoom-cardDark w-full max-w-md p-6 rounded-xl border border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {authMode === 'login' ? <LogIn className="w-5 h-5 text-zoom-blue" /> : <UserPlus className="w-5 h-5 text-zoom-blue" />}
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </h3>
              <button onClick={() => setShowAuthModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="text-xs text-zoom-textMuted mb-1 block">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="John Doe"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-zoom-textMuted mb-1 block">Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="name@company.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                />
              </div>
              <div>
                <label className="text-xs text-zoom-textMuted mb-1 block">Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                />
              </div>

              <button type="submit" className="w-full py-2.5 bg-zoom-blue hover:bg-zoom-blueHover text-sm font-semibold rounded mt-2 transition">
                {authMode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-xs text-zoom-blue hover:underline"
              >
                {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zoom-cardDark w-full max-w-md p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Join Meeting</h3>
            <form onSubmit={handleJoinMeeting} className="space-y-4">
              <div>
                <label className="text-xs text-zoom-textMuted mb-1 block">Meeting ID</label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter 10-digit Meeting ID"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                />
              </div>
              <div>
                <label className="text-xs text-zoom-textMuted mb-1 block">Your Name</label>
                <input 
                  type="text" 
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowJoinModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm bg-zoom-blue font-medium rounded hover:bg-zoom-blueHover">Join</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zoom-cardDark w-full max-w-md p-6 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Schedule Meeting</h3>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-zoom-textMuted mb-1 block">Topic</label>
                <input 
                  type="text" 
                  required
                  placeholder="Meeting Title"
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zoom-textMuted mb-1 block">Date</label>
                  <input 
                    type="date" 
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                  />
                </div>
                <div>
                  <label className="text-xs text-zoom-textMuted mb-1 block">Time</label>
                  <input 
                    type="time" 
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full px-3 py-2 bg-zoom-bgDark border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-zoom-blue"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm bg-zoom-blue font-medium rounded hover:bg-zoom-blueHover">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}