
import React, { useState, useEffect } from 'react';
import { Casino } from '../types';
import { Icons } from './Icon';

interface FocusCardProps {
  casino: Casino;
  onClaim: (id: string) => void;
  onResetTimer: (id: string) => void;
}

export const FocusCard: React.FC<FocusCardProps> = ({ casino, onClaim, onResetTimer }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(casino.url);

  const calculateStatus = () => {
    const now = Date.now();
    const lastClaim = casino.lastDailyClaim || 0;
    const config = casino.bonusConfig || { type: 'rolling', cooldownHours: 24 };

    let readyTime = 0;
    let totalDuration = 0;
    let startTime = lastClaim;

    if (config.type === 'rolling') {
      const cooldownMs = (config.cooldownHours || 24) * 60 * 60 * 1000;
      totalDuration = cooldownMs;
      readyTime = lastClaim + cooldownMs;
    } else {
      const [resetHour, resetMinute] = (config.resetTime || "00:00").split(':').map(Number);
      const todayReset = new Date();
      todayReset.setHours(resetHour, resetMinute, 0, 0);
      const yesterdayReset = new Date(todayReset);
      yesterdayReset.setDate(yesterdayReset.getDate() - 1);
      
      const relevantReset = now > todayReset.getTime() ? todayReset : yesterdayReset;
      
      if (lastClaim < relevantReset.getTime()) {
        readyTime = 0; // Ready
      } else {
        const nextReset = new Date(relevantReset);
        nextReset.setDate(nextReset.getDate() + 1);
        readyTime = nextReset.getTime();
        startTime = relevantReset.getTime(); // Approx start time of the cycle
        totalDuration = 24 * 60 * 60 * 1000; // Fixed 24h cycle
      }
    }

    if (now >= readyTime && readyTime !== 0) {
      setIsReady(true);
      setTimeLeft('READY');
      setProgress(1);
    } else if (readyTime === 0) {
       setIsReady(true);
       setTimeLeft('READY');
       setProgress(1);
    } else {
      setIsReady(false);
      const diff = readyTime - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);

      // Calculate progress (0 = just claimed, 1 = ready)
      const elapsed = now - startTime;
      const p = Math.min(Math.max(elapsed / totalDuration, 0), 1);
      setProgress(p);
    }
  };

  useEffect(() => {
    calculateStatus();
    const interval = setInterval(calculateStatus, 1000);
    return () => clearInterval(interval);
  }, [casino.lastDailyClaim, casino.bonusConfig]);

  const handleAction = (isClaim: boolean) => {
    if (navigator.vibrate) navigator.vibrate(15);
    if (isClaim) onClaim(casino.id);
    else {
      // Launch logic
    }
  };

  // Visual variants depending on status
  const cardBg = isReady 
    ? 'bg-gradient-to-br from-[#064e3b] to-[#022c22] border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.15)]' 
    : 'bg-zinc-950 border-zinc-800/80 grayscale-[0.3]';

  // Circle Config
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className={`relative flex flex-col rounded-3xl border transition-all duration-500 overflow-hidden ${cardBg}`}>
      
      {/* Background Decor */}
      {isReady && <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>}

      <div className="relative z-10 flex flex-col h-full min-h-[300px]">
        {/* Header */}
        <div className="flex justify-between items-start p-5 pb-0">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
                {faviconUrl && (
                    <img 
                    src={faviconUrl} 
                    alt="" 
                    className="w-6 h-6 rounded-lg object-contain bg-white/5"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                    />
                )}
                <h3 className={`text-lg font-black uppercase tracking-tight truncate pr-4 ${isReady ? 'text-white' : 'text-zinc-400'}`}>
                {casino.name}
                </h3>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
               <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isReady ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                 Daily Bonus
               </div>
               {!isReady && (
                 <button 
                    onClick={(e) => { 
                      e.stopPropagation();
                      if(navigator.vibrate) navigator.vibrate(10); 
                      onResetTimer(casino.id); 
                    }} 
                    className="w-12 h-12 flex items-center justify-center -my-3 -mr-2 text-zinc-600 hover:text-zinc-400 ripple rounded-full"
                 >
                   <Icons.Config size={18} />
                 </button>
               )}
            </div>
          </div>
          
          {/* Status Icon */}
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner border border-white/5 ${isReady ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-zinc-600'}`}>
             {isReady ? <Icons.Bonus size={20} className="animate-pulse" /> : <Icons.Lock size={16} />}
          </div>
        </div>

        {/* Centerpiece: Circular Timer or Status */}
        <div className="flex-1 flex items-center justify-center py-6 relative pb-8">
          
          {/* Progress Ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-80 pb-8">
             <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 128 128">
               {/* Track */}
               <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="3" className="text-white/5" fill="transparent" />
               {/* Progress */}
               <circle 
                 cx="64" cy="64" r={radius} 
                 stroke="currentColor" strokeWidth="3" 
                 className={isReady ? "text-emerald-500" : "text-amber-500 transition-all duration-1000 ease-linear"} 
                 fill="transparent" 
                 strokeDasharray={circumference} 
                 strokeDashoffset={strokeDashoffset} 
                 strokeLinecap="round" 
               />
             </svg>
          </div>

          <div className="relative z-10 pb-8">
            {isReady ? (
                <div className="text-center space-y-1 animate-in zoom-in duration-300">
                <div className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] tracking-tighter">READY</div>
                <div className="text-[10px] uppercase font-bold text-emerald-500/70 tracking-[0.3em]">Claim Now</div>
                </div>
            ) : (
                <div className="text-center space-y-1">
                <div className="text-3xl font-black text-zinc-400 tracking-tighter tabular-nums">{timeLeft.split(' ')[0]}</div>
                <div className="text-[10px] uppercase font-bold text-zinc-600 tracking-[0.3em]">Cooldown</div>
                </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-3 bg-black/20 backdrop-blur-sm border-t border-white/5">
          <a 
            href={casino.url}
            target="_blank"
            onClick={() => handleAction(isReady)}
            className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-[0.98] ripple ${
              isReady 
                ? 'bg-white text-emerald-900 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:bg-emerald-50' 
                : 'bg-zinc-900 text-zinc-600 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-400'
            }`}
          >
            {isReady ? (
               <>Claim <Icons.Link size={14} /></>
            ) : (
               <>Launch <Icons.Link size={14} /></>
            )}
          </a>
        </div>
      </div>
    </div>
  );
};
