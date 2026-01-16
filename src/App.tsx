
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Casino, FilterType, Profile, GlobalCasinoSettings, ProfileData, ProfileColor, BonusConfig } from './types';
import { INITIAL_URLS, PROFILE_AVATARS, parseNameFromUrl } from './constants';
import { Icons } from './components/Icon';
import { CasinoCard } from './components/CasinoCard';
import { FocusCard } from './components/FocusCard';
import { CredentialModal } from './components/CredentialModal';
import { GlobalConfig } from './components/GlobalConfig';
import { encryptData, decryptData, hashPassword } from './utils/crypto';

const PAGE_SIZE = 24;
const AUTO_LOCK_TIMEOUT = 120000; // 2 minutes
const COLOR_CYCLE: ProfileColor[] = ['emerald', 'purple', 'blue', 'pink', 'red', 'orange'];

const isBonusReady = (casino: Casino): boolean => {
  if (!casino.isSignedUp || !casino.hasDailyBonus) return false;
  const now = Date.now();
  const lastClaim = casino.lastDailyClaim || 0;
  const config = casino.bonusConfig || { type: 'rolling', cooldownHours: 24 };

  if (config.type === 'rolling') {
    const cooldownMs = (config.cooldownHours || 24) * 60 * 60 * 1000;
    const readyTime = lastClaim + cooldownMs;
    return now >= readyTime;
  } else {
    const [resetHour, resetMinute] = (config.resetTime || "00:00").split(':').map(Number);
    const todayReset = new Date();
    todayReset.setHours(resetHour, resetMinute, 0, 0);
    const yesterdayReset = new Date(todayReset);
    yesterdayReset.setDate(yesterdayReset.getDate() - 1);
    const relevantReset = now > todayReset.getTime() ? todayReset : yesterdayReset;
    return lastClaim < relevantReset.getTime();
  }
};

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'spinning' | 'revealed' | 'fading'>('spinning');
  const [lockedReels, setLockedReels] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const targetWord = "SPINVAULT";
  const symbols = ['🎰', '💎', '🍒', '🔔', '🍋', '7️⃣', '💰', '🎲', '🃏'];

  useEffect(() => {
    const reelTimer = setInterval(() => {
      setLockedReels(prev => {
        if (prev < targetWord.length) return prev + 1;
        clearInterval(reelTimer);
        setPhase('revealed');
        return prev;
      });
    }, 120);

    const fadeTimer = setTimeout(() => {
      setPhase('fading');
      setTimeout(onComplete, 800);
    }, 3200);

    return () => {
      clearInterval(reelTimer);
      clearTimeout(fadeTimer);
    };
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles: any[] = [];

    const animate = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (phase === 'revealed' && particles.length < 100) {
        particles.push({
          x: canvas.width / 2,
          y: canvas.height / 2,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          size: Math.random() * 3 + 1,
          color: Math.random() > 0.5 ? '#10b981' : '#f59e0b',
          alpha: 1
        });
      }
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.alpha -= 0.01;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (p.alpha <= 0) particles.splice(i, 1);
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [phase]);

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ease-in-out overflow-hidden ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}`}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1 p-2 md:p-4 bg-zinc-900/50 border-[4px] border-emerald-500/30 rounded-3xl shadow-[0_0_80px_rgba(16,185,129,0.3)] animate-float-1">
            {targetWord.split('').map((char, i) => (
              <div key={i} className="w-8 h-12 md:w-14 md:h-20 bg-zinc-950 border-2 border-zinc-800 rounded-xl flex items-center justify-center overflow-hidden relative shadow-inner">
                <div className={`flex flex-col items-center gap-4 transition-transform duration-300 ease-out`} style={{ transform: lockedReels > i ? 'translateY(0)' : 'translateY(-100%)' }}>
                  <span className="text-xl md:text-3xl font-black text-emerald-500 italic drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{lockedReels > i ? char : symbols[i % symbols.length]}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={`flex flex-col items-center transition-all duration-1000 space-y-2 ${phase === 'revealed' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <span className="text-[10px] font-black text-zinc-500 italic tracking-[0.4em] uppercase">System Command</span>
            <span className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-400 italic tracking-widest uppercase animate-logo-glow">Bonus Tracker & Vault</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const OnboardingScreen: React.FC<{
  casinos: Casino[];
  onToggle: (id: string, currentState: boolean) => void;
  onFinish: () => void;
}> = ({ casinos, onToggle, onFinish }) => {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');
  const filtered = casinos.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const nextStep = (s: number) => {
    if (navigator.vibrate) navigator.vibrate(10);
    setStep(s);
  };

  const Header = () => (
    <div className="px-8 pt-10 pb-4">
       <div className="flex items-center gap-2 mb-6">
         {[1,2,3,4,5].map(s => (
           <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? 'w-8 bg-emerald-500' : 'w-2 bg-zinc-800'}`} />
         ))}
       </div>
       <h1 className="text-4xl font-black italic uppercase text-white tracking-tight">SpinVault <span className="text-emerald-500">Setup</span></h1>
    </div>
  );

  switch (step) {
    case 1:
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-in fade-in zoom-in-95 duration-700 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
           <div className="w-24 h-24 bg-zinc-900 border-2 border-zinc-800 rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
              <span className="text-4xl">🎰</span>
           </div>
           <h1 className="text-5xl font-black italic uppercase text-white mb-4 tracking-tighter">Welcome</h1>
           <p className="text-zinc-400 max-w-xs leading-relaxed mb-12">Your centralized bonus tracker and secure credential vault. Never miss a free daily reward again.</p>
           <button onClick={() => nextStep(2)} className="w-full max-w-xs h-16 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-900/40 hover:scale-105 transition-transform ripple">Initialize</button>
        </div>
      );
    case 2:
      return (
        <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500 bg-black">
          <div className="px-6 pt-12 pb-6 bg-zinc-950 border-b border-zinc-800">
             <h2 className="text-3xl font-black uppercase text-white italic tracking-tight">Select Casinos</h2>
             <div className="relative mt-4">
               <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
               <input type="text" placeholder="Search list..." className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 text-white outline-none focus:border-emerald-500 transition-colors" value={search} onChange={(e) => setSearch(e.target.value)} />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2 bg-black">
            {filtered.map(casino => (
              <CasinoCard key={casino.id} casino={casino} variant="minimal" onToggleJoined={(id, s) => { if(navigator.vibrate) navigator.vibrate(10); onToggle(id, s); }} />
            ))}
          </div>
          <div className="p-4 bg-zinc-950 border-t border-zinc-900">
            <button onClick={() => nextStep(3)} className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg ripple">Continue ({casinos.filter(c => c.isSignedUp).length})</button>
          </div>
        </div>
      );
    case 3:
      return (
           <div className="flex flex-col h-full bg-zinc-950 animate-in slide-in-from-right-8 duration-500">
              <Header />
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
                  <Icons.Lock size={64} className="text-zinc-700" />
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black text-white uppercase italic">Secure Vault</h3>
                    <p className="text-zinc-400">All your logins are encrypted with AES-256 using your PIN. We never see your data.</p>
                  </div>
              </div>
              <div className="p-6">
                  <button onClick={() => nextStep(4)} className="w-full h-14 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-800 ripple">Next Tip</button>
              </div>
           </div>
      );
    case 4:
       return (
           <div className="flex flex-col h-full bg-zinc-950 animate-in slide-in-from-right-8 duration-500">
              <Header />
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
                  <Icons.Daily size={64} className="text-blue-500" />
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black text-white uppercase italic">Daily Bonuses</h3>
                    <p className="text-zinc-400">Mark casinos as "Daily" to track cooldown timers. Switch to "Focus" mode to see what's ready to claim.</p>
                  </div>
              </div>
              <div className="p-6">
                  <button onClick={() => nextStep(5)} className="w-full h-14 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-800 ripple">Next Tip</button>
              </div>
           </div>
       );
    case 5:
      return (
           <div className="flex flex-col h-full bg-zinc-950 animate-in slide-in-from-right-8 duration-500">
              <Header />
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
                  <Icons.Check size={64} className="text-emerald-500" />
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black text-white uppercase italic">Ready to Roll</h3>
                    <p className="text-zinc-400">You can customize global settings and add your own custom casino links at any time.</p>
                  </div>
              </div>
              <div className="p-6">
                  <button onClick={onFinish} className="w-full h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg ripple">Enter Vault</button>
              </div>
           </div>
      );
    default: return null;
  }
};

const PinPrompt: React.FC<{
  profile: Profile;
  onSuccess: (pin: string, decryptedData: Record<string, ProfileData>) => void;
  onCancel: () => void;
}> = ({ profile, onSuccess, onCancel }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading || pin.length < 4) return;
    
    setLoading(true);
    setError(false);

    // Simulate slight processing delay for better UX feel
    await new Promise(r => setTimeout(r, 400));

    try {
      const hashed = await hashPassword(pin);
      if (profile.hashedPin && hashed !== profile.hashedPin) {
        throw new Error('Invalid PIN');
      }

      const decrypted = profile.encryptedVault 
        ? await decryptData(profile.encryptedVault, pin)
        : profile.casinoData;

      if(navigator.vibrate) navigator.vibrate([10, 30]); // Success pattern
      onSuccess(pin, decrypted);
    } catch (err) {
      setError(true);
      setPin('');
      if(navigator.vibrate) navigator.vibrate([50, 50, 50]); // Error pattern
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) handleSubmit();
  }, [pin]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in-95 slide-in-from-bottom-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-24 h-24 bg-zinc-900 border-2 border-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
             {profile.avatar ? (
                <span className="text-5xl animate-in zoom-in duration-500">{profile.avatar}</span>
             ) : (
                <Icons.Lock className={error ? 'text-red-500' : 'text-emerald-500'} size={40} />
             )}
          </div>
          <h2 className="text-2xl font-black uppercase text-white italic">Unlock Vault</h2>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Enter PIN for {profile.name}</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`w-12 h-16 rounded-2xl border-2 flex items-center justify-center transition-all ${error ? 'border-red-500 bg-red-500/10' : pin.length > i ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-zinc-800 bg-zinc-900'}`}>
                {pin.length > i && <div className="w-3 h-3 bg-white rounded-full" />}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Clear', 0, 'X'].map((val) => (
              <button
                key={val}
                disabled={loading}
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(5);
                  if (val === 'Clear') setPin('');
                  else if (val === 'X') onCancel();
                  else if (typeof val === 'number' && pin.length < 4) setPin(p => p + val);
                }}
                className={`h-16 rounded-2xl border-2 border-zinc-800 font-black text-lg transition-all active:scale-95 disabled:opacity-50 ripple ${val === 'X' ? 'bg-zinc-900 text-red-500 hover:bg-red-500/10' : 'bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StartupScreen: React.FC<{
  profiles: Profile[];
  onSelect: (p: Profile) => void;
  onAdd: (name: string, pin: string, avatar: string) => void;
  onOpenConfig: () => void;
}> = ({ profiles, onSelect, onAdd, onOpenConfig }) => {
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newAvatar, setNewAvatar] = useState(PROFILE_AVATARS[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  const getColorClass = (scheme: ProfileColor) => {
    switch (scheme) {
      case 'emerald': return 'bg-emerald-500 shadow-emerald-500/20 text-emerald-100';
      case 'purple': return 'bg-purple-500 shadow-purple-500/20 text-purple-100';
      case 'blue': return 'bg-blue-500 shadow-blue-500/20 text-blue-100';
      case 'pink': return 'bg-pink-500 shadow-pink-500/20 text-pink-100';
      case 'red': return 'bg-red-500 shadow-red-500/20 text-red-100';
      case 'orange': return 'bg-orange-500 shadow-orange-500/20 text-orange-100';
      default: return 'bg-zinc-500 text-white';
    }
  };

  const handleCreate = () => {
    setError('');
    const trimmed = newName.trim();
    
    if (trimmed.toLowerCase() === 'system' || trimmed === '0000') {
      setError('Name is reserved.');
      if(navigator.vibrate) navigator.vibrate(50);
      return;
    }

    if (!trimmed) {
      setError('Please enter a name.');
      if(navigator.vibrate) navigator.vibrate(50);
      return;
    }

    if (profiles.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Name already in use.');
      if(navigator.vibrate) navigator.vibrate(50);
      return;
    }

    if(navigator.vibrate) navigator.vibrate(10);
    onAdd(trimmed, newPin, newAvatar);
    setNewName('');
    setNewPin('');
    setNewAvatar(PROFILE_AVATARS[Math.floor(Math.random() * PROFILE_AVATARS.length)]);
    setShowAddForm(false);
  };

  const isFull = profiles.length >= 8;

  return (
    <div className="flex flex-col min-h-screen w-full max-w-2xl mx-auto bg-black text-zinc-200 p-8 relative overflow-hidden animate-in fade-in duration-1000">
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 space-y-12">
        <header className="text-center space-y-2">
          <h1 className="text-6xl font-black tracking-tighter text-white leading-none italic uppercase drop-shadow-2xl">SPINVAULT</h1>
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-[0.4em] opacity-80">Bonus Tracker & Vault</p>
        </header>

        <div className="w-full max-w-sm space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar py-4 px-1">
          {profiles.map((p) => (
            <button key={p.id} onClick={() => { if(navigator.vibrate) navigator.vibrate(10); onSelect(p); }} className="w-full group flex items-center gap-5 p-5 rounded-[2.5rem] bg-zinc-900/60 border-2 border-zinc-800/60 hover:border-emerald-500/40 transition-all duration-300 btn-press-effect elevation-2 ripple">
              <div className={`w-14 h-14 rounded-full border-2 border-white/10 shadow-lg shrink-0 flex items-center justify-center text-2xl ${getColorClass(p.colorScheme)}`}>
                 {p.avatar || p.name[0]}
              </div>
              <span className="flex-1 text-left font-black uppercase text-sm tracking-widest text-zinc-400 group-hover:text-white transition-colors truncate">{p.name}</span>
              {p.isSecure && <Icons.Lock size={14} className="text-zinc-600" />}
              <Icons.Next size={18} className="text-zinc-600 group-hover:text-white transition-all" />
            </button>
          ))}
          {profiles.length === 0 && (
            <div className="p-8 text-center text-zinc-600 text-xs uppercase tracking-widest font-bold">
              No profiles found
            </div>
          )}
        </div>

        <div className="w-full max-w-sm pt-8 border-t border-zinc-900 space-y-4">
          {!showAddForm ? (
            <button 
              disabled={isFull}
              onClick={() => { if(navigator.vibrate) navigator.vibrate(10); setShowAddForm(true); }} 
              className={`w-full h-16 border-2 rounded-3xl flex items-center justify-center gap-3 font-black uppercase tracking-widest transition-all ripple ${isFull ? 'bg-zinc-900/10 border-zinc-900 text-zinc-800' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'}`}
            >
              {isFull ? "Max Profiles Reached" : <><Icons.Clear size={20} className="rotate-45" /> New Profile</>}
            </button>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 bg-zinc-950 p-6 rounded-[2rem] border border-zinc-800/60 shadow-2xl">
              <div className="text-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Select Avatar</span>
              </div>
              
              <div className="w-full overflow-x-auto no-scrollbar py-2 -mx-2 px-2">
                <div className="flex gap-2 w-max pb-2">
                  {PROFILE_AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => setNewAvatar(avatar)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${newAvatar === avatar ? 'bg-zinc-800 border-emerald-500 scale-110 shadow-lg' : 'bg-zinc-900 border-zinc-800 opacity-60 hover:opacity-100'}`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}
              
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Profile Name" className="w-full h-14 bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 text-sm font-bold text-white outline-none focus:border-emerald-500 transition-all uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal" />
              
              <div className="flex gap-3">
                <input type="password" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="4-Digit PIN (Optional)" className="flex-1 h-14 bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 text-sm font-bold text-white outline-none focus:border-emerald-500 transition-all" />
              </div>
              
              <div className="flex gap-3 pt-2">
                 <button onClick={() => { setShowAddForm(false); setError(''); }} className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase text-zinc-500 border border-zinc-800 hover:text-white transition-colors ripple">Cancel</button>
                 <button onClick={handleCreate} className="flex-[2] h-12 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest btn-press-bright shadow-[0_4px_15px_rgba(16,185,129,0.3)] ripple">Create Profile</button>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => { if(navigator.vibrate) navigator.vibrate(10); onOpenConfig(); }}
            className="w-full h-14 mt-4 rounded-2xl border-2 border-zinc-800/50 bg-zinc-900/20 flex items-center justify-center gap-3 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 transition-all btn-press-effect group ripple"
          >
            <Icons.Config size={16} className="group-hover:rotate-180 transition-transform duration-700" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Global System Config</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileEditModal: React.FC<{ 
  profile: Profile; 
  allProfiles: Profile[];
  onDelete: () => void;
  onUpdate: (data: Partial<Profile>) => void;
  onClose: () => void; 
}> = ({ profile, allProfiles, onDelete, onUpdate, onClose }) => {
  const [name, setName] = useState(profile.name);
  const [color, setColor] = useState<ProfileColor>(profile.colorScheme);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onUpdate({ name, colorScheme: color });
    onClose();
  };

  const getColorHex = (c: ProfileColor) => {
     switch(c) {
       case 'emerald': return '#10b981';
       case 'purple': return '#a855f7';
       case 'blue': return '#3b82f6';
       case 'pink': return '#ec4899';
       case 'red': return '#ef4444';
       case 'orange': return '#f97316';
       default: return '#10b981';
     }
  };

  if (confirmDelete) {
     return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6 animate-in fade-in">
           <div className="w-full max-w-sm bg-zinc-900 border border-red-900/50 rounded-3xl p-6 text-center space-y-6">
              <Icons.Alert size={48} className="mx-auto text-red-500" />
              <div>
                 <h3 className="text-xl font-black text-white uppercase">Delete Profile?</h3>
                 <p className="text-zinc-500 text-sm mt-2">This will permanently erase all data, including your vault and tracking history.</p>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setConfirmDelete(false)} className="flex-1 py-4 rounded-xl bg-zinc-800 text-white font-bold uppercase tracking-widest">Cancel</button>
                 <button onClick={onDelete} className="flex-1 py-4 rounded-xl bg-red-600 text-white font-bold uppercase tracking-widest">Delete</button>
              </div>
           </div>
        </div>
     )
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
            <h2 className="text-lg font-black text-white uppercase italic">Edit Profile</h2>
            <button onClick={onClose}><Icons.Clear size={20} className="text-zinc-500 hover:text-white" /></button>
        </div>
        <div className="p-6 space-y-6">
           <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Profile Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 text-white font-bold outline-none focus:border-emerald-500" />
           </div>
           
           <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Theme Color</label>
              <div className="flex justify-between gap-2">
                 {COLOR_CYCLE.map(c => (
                    <button 
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent opacity-50'}`}
                      style={{ backgroundColor: getColorHex(c) }}
                    />
                 ))}
              </div>
           </div>
           
           <button onClick={() => setConfirmDelete(true)} className="w-full py-4 flex items-center justify-center gap-2 text-red-500 bg-red-500/10 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-red-500/20">
              <Icons.Trash size={16} /> Delete Profile
           </button>
        </div>
        <div className="p-4 bg-zinc-900/50 border-t border-zinc-900 flex gap-3">
           <button onClick={onClose} className="flex-1 py-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold uppercase tracking-widest hover:text-white">Cancel</button>
           <button onClick={handleSave} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-bold uppercase tracking-widest shadow-lg">Save</button>
        </div>
      </div>
    </div>
  );
};

const BonusConfirmationModal: React.FC<{
  casino: Casino;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ casino, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="w-full max-w-xs bg-zinc-900 border border-emerald-500/30 rounded-3xl p-6 text-center space-y-6 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500 animate-bounce">
                <Icons.Bonus size={40} />
            </div>
            <div>
                <h3 className="text-xl font-black text-white uppercase italic">Bonus Claimed?</h3>
                <p className="text-zinc-400 text-xs mt-2 leading-relaxed">Confirming will reset the timer for <span className="text-emerald-400">{casino.name}</span>.</p>
            </div>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-zinc-950 text-zinc-500 font-bold uppercase tracking-widest hover:text-white">Cancel</button>
                <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold uppercase tracking-widest shadow-lg shadow-emerald-900/40">Confirm</button>
            </div>
        </div>
    </div>
);

const ReferralFixModal: React.FC<{
  casino: Casino;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ casino, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="w-full max-w-xs bg-zinc-900 border border-purple-500/30 rounded-3xl p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto text-purple-500">
                <Icons.Config size={32} />
            </div>
            <div>
                <h3 className="text-lg font-black text-white uppercase italic">Enable Referrals?</h3>
                <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
                   You have a referral link saved for <span className="text-white">{casino.name}</span>, but referrals are disabled in global settings. Enable them now?
                </p>
            </div>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-zinc-950 text-zinc-500 font-bold uppercase tracking-widest hover:text-white">No</button>
                <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold uppercase tracking-widest shadow-lg shadow-purple-900/40">Yes, Fix</button>
            </div>
        </div>
    </div>
);

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [vaultKey, setVaultKey] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  
  const [globalSettings, setGlobalSettings] = useState<Record<string, GlobalCasinoSettings>>({});
  const [showGlobalConfig, setShowGlobalConfig] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('signed-up' as FilterType);
  const [filterScope, setFilterScope] = useState<'all' | 'my'>('my');
  
  const [editingState, setEditingState] = useState<{ id: string; focus?: 'referral'; tab?: 'credentials' | 'bonus' } | null>(null);
  
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showCustomAdd, setShowCustomAdd] = useState(false);
  const [newCustomUrl, setNewCustomUrl] = useState('');

  const [pendingBonusClaim, setPendingBonusClaim] = useState<{ id: string; timestamp: number } | null>(null);
  const [pendingReferralFix, setPendingReferralFix] = useState<Casino | null>(null);
  
  const [now, setNow] = useState(Date.now());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('spin-vault-data-v1');
    const savedGlobal = localStorage.getItem('spin-vault-global-v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      const migrated = parsed.map((p: any) => ({
        ...p,
        avatar: p.avatar || PROFILE_AVATARS[Math.floor(Math.random() * PROFILE_AVATARS.length)]
      }));
      setProfiles(migrated);
    }
    if (savedGlobal) setGlobalSettings(JSON.parse(savedGlobal));
  }, []);

  useEffect(() => {
    localStorage.setItem('spin-vault-data-v1', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('spin-vault-global-v1', JSON.stringify(globalSettings));
  }, [globalSettings]);

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const lockVault = () => {
    setVaultKey(null);
    setIsStarted(false);
    setActiveProfileId(null);
    setPendingProfile(null);
    setShowProfileModal(false);
    setShowGlobalConfig(false);
    setSearchQuery('');
    setVisibleCount(PAGE_SIZE);
    setActiveFilter('signed-up');
    setFilterScope('my');
    setPendingBonusClaim(null);
    setPendingReferralFix(null);
    setShowCustomAdd(false);
    if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
  };

  const resetLockTimer = () => {
    if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
    if (vaultKey) {
      lockTimerRef.current = window.setTimeout(lockVault, AUTO_LOCK_TIMEOUT);
    }
  };

  useEffect(() => {
    if (vaultKey) {
      resetLockTimer();
      const handleActivity = () => resetLockTimer();
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keypress', handleActivity);
      window.addEventListener('touchstart', handleActivity);
      return () => {
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keypress', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
        if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
      };
    }
  }, [vaultKey]);

  const activeProfile = useMemo(() => {
    return profiles.find(p => p.id === activeProfileId) || null;
  }, [profiles, activeProfileId]);

  const casinos = useMemo(() => {
    const systemList = INITIAL_URLS.map((url, index) => {
      const id = `casino-${index}`;
      const name = parseNameFromUrl(url);
      const profileData = activeProfile?.casinoData[id] || { isSignedUp: false, lastDailyClaim: 0 };
      const shared = globalSettings[id] || { hasDailyBonus: false, hasReferral: false, bonusConfig: undefined };
      return { 
        id, 
        name, 
        url, 
        isSignedUp: profileData.isSignedUp, 
        login: profileData.login, 
        password: profileData.password,
        userReferralLink: profileData.userReferralLink,
        hasDailyBonus: shared.hasDailyBonus, 
        hasReferral: shared.hasReferral,
        bonusConfig: shared.bonusConfig,
        lastDailyClaim: profileData.lastDailyClaim,
        isCustom: false
      } as Casino;
    });

    const customList = (activeProfile?.customCasinos || []).map((c) => {
      const profileData = activeProfile?.casinoData[c.id] || { isSignedUp: true, lastDailyClaim: 0 };
      const shared = globalSettings[c.id] || { hasDailyBonus: c.hasDailyBonus, hasReferral: c.hasReferral, bonusConfig: undefined };
      return {
        ...c,
        isSignedUp: profileData.isSignedUp,
        login: profileData.login, 
        password: profileData.password,
        userReferralLink: profileData.userReferralLink,
        hasDailyBonus: shared.hasDailyBonus,
        hasReferral: shared.hasReferral,
        bonusConfig: shared.bonusConfig,
        lastDailyClaim: profileData.lastDailyClaim,
        isCustom: true
      } as Casino;
    });

    return [...systemList.sort((a, b) => a.name.localeCompare(b.name)), ...customList];
  }, [activeProfile, globalSettings]);

  const filterCounts = useMemo(() => ({
    all: casinos.length,
    signedUp: casinos.filter(c => c.isSignedUp).length,
    daily: casinos.filter(c => c.hasDailyBonus).length,
    referral: casinos.filter(c => c.hasReferral).length
  }), [casinos]);

  const readyBonusCount = useMemo(() => {
    return casinos.filter(c => isBonusReady(c)).length;
  }, [casinos, now]);

  const filteredCasinos = useMemo(() => {
    let list = casinos.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeFilter === 'focus') {
      list = list.filter(c => c.isSignedUp && c.hasDailyBonus === true);
    } else if (activeFilter === 'signed-up') {
      list = list.filter(c => c.isSignedUp);
    } else if (activeFilter === 'daily') {
       list = list.filter(c => c.hasDailyBonus);
       list.sort((a, b) => (a.isSignedUp === b.isSignedUp ? 0 : a.isSignedUp ? -1 : 1));
    } else if (activeFilter === 'referral') {
       list = list.filter(c => c.hasReferral);
       list.sort((a, b) => (a.isSignedUp === b.isSignedUp ? 0 : a.isSignedUp ? -1 : 1));
    }

    return list;
  }, [casinos, searchQuery, activeFilter, filterScope]);

  const visibleCasinos = useMemo(() => filteredCasinos.slice(0, visibleCount), [filteredCasinos, visibleCount]);

  const toggleCasinoJoined = async (id: string, currentState: boolean) => {
    if (!activeProfileId || !activeProfile) return;
    triggerHaptic();
    
    const newCasinoData = { 
      ...activeProfile.casinoData, 
      [id]: { 
        ...activeProfile.casinoData[id], 
        isSignedUp: !currentState 
      } 
    };

    let encryptedVault = activeProfile.encryptedVault;
    if (activeProfile.isSecure && vaultKey) {
      encryptedVault = await encryptData(newCasinoData, vaultKey);
    }
    
    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, casinoData: newCasinoData, encryptedVault } : p));
  };

  const handleUpdateCasino = async (updated: Casino) => {
    if (!activeProfileId) return;
    
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile) return;
    if (profile.isSecure && !vaultKey) return;
    
    setGlobalSettings(prev => ({ 
      ...prev, 
      [updated.id]: { 
        hasDailyBonus: updated.hasDailyBonus, 
        hasReferral: updated.hasReferral,
        bonusConfig: updated.bonusConfig
      } 
    }));

    const newCasinoData = { 
      ...profile.casinoData, 
      [updated.id]: { 
        login: updated.login, 
        password: updated.password, 
        isSignedUp: updated.isSignedUp,
        userReferralLink: updated.userReferralLink
      } 
    };

    let encryptedVault = profile.encryptedVault;
    if (profile.isSecure && vaultKey) {
      encryptedVault = await encryptData(newCasinoData, vaultKey);
    }
    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, casinoData: newCasinoData, encryptedVault } : p));
    setEditingState(null);
  };

  const handleGlobalConfigUpdate = (id: string, type: 'daily' | 'referral', value: boolean | null) => {
    triggerHaptic();
    setGlobalSettings(prev => {
      const current = prev[id] || { hasDailyBonus: false, hasReferral: false };
      return {
        ...prev,
        [id]: {
          ...current,
          hasDailyBonus: type === 'daily' ? value : current.hasDailyBonus,
          hasReferral: type === 'referral' ? value : current.hasReferral
        }
      };
    });
  };

  const handleOpenBonusSettings = (id: string) => {
    triggerHaptic();
    setEditingState({ id, tab: 'bonus' });
  };

  const handleClaimClick = (id: string) => {
    triggerHaptic();
    const timestamp = Date.now();
    setPendingBonusClaim({ id, timestamp });
  };

  const confirmClaim = async () => {
    if (!activeProfileId || !activeProfile || !pendingBonusClaim) return;

    const currentData = activeProfile.casinoData[pendingBonusClaim.id] || { isSignedUp: true };
    const newCasinoData = {
      ...activeProfile.casinoData,
      [pendingBonusClaim.id]: {
        ...currentData,
        lastDailyClaim: pendingBonusClaim.timestamp
      }
    };

    let encryptedVault = activeProfile.encryptedVault;
    if (activeProfile.isSecure && vaultKey) {
      encryptedVault = await encryptData(newCasinoData, vaultKey);
    }

    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, casinoData: newCasinoData, encryptedVault } : p));
    setPendingBonusClaim(null);
  };

  const handleFixReferralMismatch = (id: string) => {
    const casino = casinos.find(c => c.id === id);
    if (casino) setPendingReferralFix(casino);
  };

  const confirmReferralFix = () => {
    if (pendingReferralFix) {
      handleGlobalConfigUpdate(pendingReferralFix.id, 'referral', true);
      setPendingReferralFix(null);
    }
  };

  const handleResetTimer = async (id: string) => {
    if (!activeProfileId || !activeProfile) return;
    
    const currentData = activeProfile.casinoData[id] || { isSignedUp: true };
    const newCasinoData = {
      ...activeProfile.casinoData,
      [id]: {
        ...currentData,
        lastDailyClaim: 0
      }
    };

    let encryptedVault = activeProfile.encryptedVault;
    if (activeProfile.isSecure && vaultKey) {
      encryptedVault = await encryptData(newCasinoData, vaultKey);
    }

    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, casinoData: newCasinoData, encryptedVault } : p));
  };

  const addNewProfile = async (name: string, pin: string, avatar: string) => {
    lockVault();
    const usedColors = profiles.map(p => p.colorScheme);
    const availableColor = COLOR_CYCLE.find(c => !usedColors.includes(c));
    if (!availableColor) return;

    const newId = `p-${Date.now()}`;
    const hashedPin = pin ? await hashPassword(pin) : undefined;
    const newProfile: Profile = { id: newId, name, colorScheme: availableColor, avatar: avatar, casinoData: {}, customCasinos: [], isSecure: !!pin, hashedPin, isOnboarded: false };
    setProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newId);
    if (pin) setVaultKey(pin);
    setIsStarted(true);
  };

  const handleProfileSelect = (p: Profile) => {
    lockVault();
    triggerHaptic();
    if (p.isSecure) {
      setPendingProfile(p);
    } else {
      setActiveProfileId(p.id);
      setIsStarted(true);
    }
  };

  const handleUnlock = (pin: string, decryptedData: Record<string, ProfileData>) => {
    if (!pendingProfile) return;
    setVaultKey(pin);
    setProfiles(prev => prev.map(p => p.id === pendingProfile.id ? { ...p, casinoData: decryptedData } : p));
    setActiveProfileId(pendingProfile.id);
    setPendingProfile(null);
    setIsStarted(true);
  };

  const handleAddCustomCasino = async () => {
    if (!newCustomUrl || !activeProfileId) return;
    triggerHaptic();
    const url = newCustomUrl.startsWith('http') ? newCustomUrl : `https://${newCustomUrl}`;
    const name = parseNameFromUrl(url);
    const id = `custom-${Date.now()}`;
    const newCasino: Casino = { id, name, url, isSignedUp: true, hasDailyBonus: false, hasReferral: false, isCustom: true };

    setProfiles(prev => prev.map(p => {
       if (p.id !== activeProfileId) return p;
       return {
         ...p,
         customCasinos: [...(p.customCasinos || []), newCasino],
         casinoData: {
           ...p.casinoData,
           [id]: { isSignedUp: true }
         }
       };
    }));
    setNewCustomUrl('');
    setShowCustomAdd(false);
  };

  const finishOnboarding = () => {
    setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, isOnboarded: true } : p));
  };

  const getProfileColorClass = (color?: ProfileColor) => {
    switch (color) {
      case 'purple': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'blue': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'pink': return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
      case 'red': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'orange': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  const getFilterStyles = (id: string) => {
    const isActive = activeFilter === id;
    if (!isActive) return 'bg-zinc-900/50 text-zinc-500 border-zinc-800/50';
    switch (id) {
      case 'focus': return 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] font-black';
      case 'signed-up': return 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
      case 'daily': return 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
      case 'referral': return 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]';
      default: return 'bg-zinc-700 text-white border-zinc-500';
    }
  };

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  
  if (showGlobalConfig) {
     const allCasinosForConfig = INITIAL_URLS.map((url, index) => {
      const id = `casino-${index}`;
      const name = parseNameFromUrl(url);
      const shared = globalSettings[id] || { hasDailyBonus: false, hasReferral: false, bonusConfig: undefined };
      return { id, name, url, isSignedUp: false, hasDailyBonus: shared.hasDailyBonus, hasReferral: shared.hasReferral, bonusConfig: shared.bonusConfig } as Casino;
    }).sort((a, b) => a.name.localeCompare(b.name));

    return (
      <GlobalConfig 
        casinos={allCasinosForConfig} 
        onUpdateGlobal={handleGlobalConfigUpdate}
        onClose={() => setShowGlobalConfig(false)}
      />
    );
  }

  if (pendingProfile) return <PinPrompt profile={pendingProfile} onSuccess={handleUnlock} onCancel={() => setPendingProfile(null)} />;
  
  if (!isStarted || !activeProfileId) return (
    <StartupScreen 
      profiles={profiles} 
      onSelect={handleProfileSelect} 
      onAdd={addNewProfile} 
      onOpenConfig={() => setShowGlobalConfig(true)}
    />
  );

  if (activeProfile?.isOnboarded === false) {
    return (
      <OnboardingScreen 
        casinos={casinos} 
        onToggle={toggleCasinoJoined} 
        onFinish={finishOnboarding} 
      />
    );
  }

  const isFullWidth = activeFilter === 'all' || activeFilter === 'focus' || activeFilter === 'referral' || activeFilter === 'daily';

  return (
    <div ref={scrollContainerRef} onScroll={(e) => setShowBackToTop(e.currentTarget.scrollTop > 400)} className="flex flex-col h-screen max-w-2xl mx-auto bg-black text-zinc-200 overflow-y-auto no-scrollbar relative animate-in fade-in duration-700">
      <div className="relative z-10 min-h-full pb-20">
        
        <header className="px-6 pt-12 pb-6 space-y-8">
          <div className="flex justify-between items-center">
            <button onClick={() => { triggerHaptic(); lockVault(); }} className="text-left space-y-1.5 btn-press-effect group ripple">
              <h1 className="text-4xl font-black tracking-tighter text-white leading-none italic uppercase drop-shadow-lg">
                SPIN<span className="text-emerald-500 group-hover:text-emerald-400 transition-colors">VAULT</span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.4em] pl-0.5 group-hover:text-emerald-500/50 transition-colors">Session Command</p>
            </button>

            <div className="flex gap-2.5">
              <button onClick={() => { triggerHaptic(); lockVault(); }} title="Home Selection" className="w-12 h-12 rounded-2xl bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/30 transition-all active:scale-95 shadow-lg ripple">
                <Icons.Home size={20} />
              </button>

              <button 
                onClick={() => { triggerHaptic(); setShowGlobalConfig(true); }} 
                title="System Config" 
                className="w-12 h-12 rounded-2xl bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/30 transition-all active:scale-95 shadow-lg ripple"
              >
                <Icons.Config size={20} />
              </button>

              <button onClick={() => { triggerHaptic(); setShowProfileModal(true); }} className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center overflow-hidden active:scale-95 group transition-all shadow-lg text-2xl ripple ${getProfileColorClass(activeProfile?.colorScheme)}`}>
                 {activeProfile?.avatar}
              </button>
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-50 px-4 py-3 flex flex-col gap-3 surface-glass border-b border-zinc-800/80 shadow-2xl backdrop-blur-xl transition-all">
          <div className="relative flex items-center group">
            <Icons.Search className="absolute left-4 text-zinc-500 z-10 group-focus-within:text-emerald-500 transition-colors" size={16} strokeWidth={2.5} />
            <input 
              type="text" 
              placeholder="Search active vault..." 
              className="w-full h-11 bg-zinc-950/50 border border-zinc-800 focus:border-emerald-500 rounded-xl pl-11 pr-4 text-sm font-medium outline-none text-white shadow-inner transition-all placeholder:text-zinc-700" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>

          <div className="flex gap-2 w-full overflow-x-auto no-scrollbar pb-1">
             <button 
                onClick={() => { triggerHaptic(); setActiveFilter('focus'); }} 
                className={`relative flex-1 min-w-[60px] flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all border ${getFilterStyles('focus')} btn-press-bright ripple`}
              >
                <div className="flex items-center justify-center h-full">
                  <Icons.Focus size={20} strokeWidth={2.5} />
                </div>
                {readyBonusCount > 0 && (
                  <span className="absolute top-2 right-1/2 translate-x-3 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                )}
              </button>
            {[
              { id: 'all', label: 'All', icon: Icons.Grid, count: casinos.length }, 
              { id: 'signed-up', label: 'Joined', icon: Icons.SignedUp, count: filterCounts.signedUp }, 
              { id: 'daily', label: 'Daily', icon: Icons.Bonus, count: filterCounts.daily }, 
              { id: 'referral', label: 'Refer', icon: Icons.Referral, count: filterCounts.referral }
            ].map((f) => (
              <button 
                key={f.id} 
                onClick={() => { triggerHaptic(); setActiveFilter(f.id as FilterType); }} 
                className={`flex-1 min-w-[50px] flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all border ${getFilterStyles(f.id)} btn-press-bright ripple`}
              >
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider">
                  <f.icon size={10} strokeWidth={3} />
                  {f.label}
                </div>
                <span className="text-[9px] font-bold opacity-70">({f.count})</span>
              </button>
            ))}
          </div>
        </div>

        <main className="p-4 pt-6 space-y-8">
          <div className={`${isFullWidth ? 'flex flex-col space-y-3' : 'grid grid-cols-2 gap-3'}`}>
            {visibleCasinos.map((casino, index) => {
              const isAllView = activeFilter === 'all';
              const useMinimal = isAllView;

              if (activeFilter === 'focus') {
                 return (
                    <div key={casino.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                      <FocusCard 
                        casino={casino} 
                        onClaim={handleClaimClick}
                        onResetTimer={handleResetTimer}
                      />
                    </div>
                 );
              }

              return (
                <div key={casino.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 30}ms` }}>
                  <CasinoCard 
                    casino={{
                      ...casino,
                      login: (activeProfile?.isSecure && !vaultKey) ? '••••••••' : casino.login,
                      password: (activeProfile?.isSecure && !vaultKey) ? '••••••••' : casino.password,
                    }} 
                    variant={useMinimal ? 'minimal' : 'standard'}
                    activeFilter={activeFilter}
                    onEdit={(id, section) => setEditingState({ id, focus: section })} 
                    onToggleJoined={toggleCasinoJoined}
                    onFixReferralMismatch={handleFixReferralMismatch}
                    onOpenBonusSettings={handleOpenBonusSettings}
                    onClaim={handleClaimClick}
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-4 pb-8">
            {visibleCount < filteredCasinos.length && (
              <div className="flex justify-center">
                <button onClick={() => { triggerHaptic(); setVisibleCount(v => v + PAGE_SIZE); }} className="px-8 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:border-zinc-700 transition-all btn-press-effect ripple">Load More</button>
              </div>
            )}

            <div className="border-t border-zinc-900 pt-6 mt-4">
              {showCustomAdd ? (
                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 animate-in fade-in slide-in-from-bottom-2">
                  <h3 className="text-xs font-black uppercase text-zinc-500 mb-2">Add Custom Casino</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="casino.com" 
                      value={newCustomUrl}
                      onChange={(e) => setNewCustomUrl(e.target.value)}
                      className="flex-1 h-12 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-white text-sm font-bold outline-none focus:border-orange-500 transition-all"
                    />
                    <button 
                      onClick={handleAddCustomCasino}
                      disabled={!newCustomUrl}
                      className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center hover:bg-orange-600 transition-all disabled:opacity-50 disabled:bg-zinc-800 ripple"
                    >
                      <Icons.Check size={20} />
                    </button>
                     <button 
                      onClick={() => setShowCustomAdd(false)}
                      className="w-12 h-12 bg-zinc-800 text-zinc-400 rounded-xl flex items-center justify-center hover:text-white transition-all ripple"
                    >
                      <Icons.Clear size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => { triggerHaptic(); setShowCustomAdd(true); }}
                  className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 hover:text-white hover:border-zinc-600 hover:bg-zinc-900/30 transition-all flex items-center justify-center gap-2 ripple"
                >
                   <Icons.Config size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Add Custom Casino</span>
                </button>
              )}
            </div>
          </div>

           {activeFilter === 'focus' && filteredCasinos.length === 0 && (
             <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                <Icons.Daily size={48} className="text-zinc-600" />
                <p className="text-sm font-black uppercase text-zinc-500 text-center max-w-xs">
                   No Daily Bonuses Tracked.<br/>
                   <span className="text-xs font-normal normal-case">Mark casinos as "Daily" in Config and ensure you have "Joined" them.</span>
                </p>
             </div>
           )}
        </main>
      </div>

      <button onClick={() => { triggerHaptic(); scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`fixed bottom-6 right-6 z-50 p-4 bg-emerald-600 text-white rounded-2xl elevation-4 shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition-all duration-300 transform ripple ${showBackToTop ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-50'}`}>
        <Icons.Top size={20} strokeWidth={3} />
      </button>

      {editingState && (
        <CredentialModal 
          casino={casinos.find(c => c.id === editingState.id)!} 
          canEditGlobal={false}
          initialFocus={editingState.focus}
          initialTab={editingState.tab}
          onSave={handleUpdateCasino} 
          onClose={() => setEditingState(null)} 
        />
      )}
      
      {showProfileModal && activeProfile && (
        <ProfileEditModal 
          profile={activeProfile} 
          allProfiles={profiles}
          onDelete={() => {
            const remaining = profiles.filter(p => p.id !== activeProfileId);
            setProfiles(remaining);
            lockVault();
          }} 
          onUpdate={(up) => setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, ...up } : p))} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}

      {pendingBonusClaim && (
        <BonusConfirmationModal 
          casino={casinos.find(c => c.id === pendingBonusClaim.id)!}
          onConfirm={confirmClaim}
          onCancel={() => setPendingBonusClaim(null)}
        />
      )}
      
      {pendingReferralFix && (
        <ReferralFixModal 
          casino={pendingReferralFix}
          onConfirm={confirmReferralFix}
          onCancel={() => setPendingReferralFix(null)}
        />
      )}
    </div>
  );
};
