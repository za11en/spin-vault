
import React, { useState, useRef, useEffect } from 'react';
import { Casino, FilterType } from '../types';
import { Icons } from './Icon';

interface CasinoCardProps {
  casino: Casino;
  variant?: 'standard' | 'minimal';
  activeFilter?: FilterType;
  onEdit?: (id: string, section?: 'referral') => void;
  onToggleJoined?: (id: string, currentState: boolean) => void;
  onFixReferralMismatch?: (id: string) => void;
  onOpenBonusSettings?: (id: string) => void;
  onClaim?: (id: string) => void;
}

export const CasinoCard: React.FC<CasinoCardProps> = ({ 
  casino, 
  variant = 'standard', 
  activeFilter,
  onEdit,
  onToggleJoined,
  onFixReferralMismatch,
  onOpenBonusSettings,
  onClaim
}) => {
  const [copiedLogin, setCopiedLogin] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);
  
  // Timer State for Daily View
  const [timerString, setTimerString] = useState<string>('');
  const [isBonusReady, setIsBonusReady] = useState(false);

  // Status Checks
  const missingReferralLink = casino.isSignedUp && casino.hasReferral && !casino.userReferralLink;
  const referralConfigMismatch = casino.isSignedUp && !casino.hasReferral && !!casino.userReferralLink;
  const hasActionableReferralAlert = missingReferralLink || referralConfigMismatch;

  // Long Press Logic
  const timerRef = useRef<number | null>(null);
  const isLongPress = useRef(false);

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(casino.url);

  // Timer Logic
  useEffect(() => {
    if (activeFilter !== 'daily' || !casino.hasDailyBonus) return;

    const calculateTime = () => {
      const now = Date.now();
      const lastClaim = casino.lastDailyClaim || 0;
      const config = casino.bonusConfig || { type: 'rolling', cooldownHours: 24 };
      let readyTime = 0;

      if (config.type === 'rolling') {
        const cooldownMs = (config.cooldownHours || 24) * 60 * 60 * 1000;
        readyTime = lastClaim + cooldownMs;
      } else {
        const [resetHour, resetMinute] = (config.resetTime || "00:00").split(':').map(Number);
        const todayReset = new Date();
        todayReset.setHours(resetHour, resetMinute, 0, 0);
        const yesterdayReset = new Date(todayReset);
        yesterdayReset.setDate(yesterdayReset.getDate() - 1);
        
        const relevantReset = now > todayReset.getTime() ? todayReset : yesterdayReset;
        
        if (lastClaim < relevantReset.getTime()) {
           readyTime = 0; 
        } else {
           const nextReset = new Date(relevantReset);
           nextReset.setDate(nextReset.getDate() + 1);
           readyTime = nextReset.getTime();
        }
      }

      if (now >= readyTime) {
        setIsBonusReady(true);
        setTimerString('READY TO CLAIM');
      } else {
        setIsBonusReady(false);
        const diff = readyTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimerString(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [activeFilter, casino.hasDailyBonus, casino.lastDailyClaim, casino.bonusConfig]);

  const startPress = () => {
    isLongPress.current = false;
    timerRef.current = window.setTimeout(() => {
      isLongPress.current = true;
      if (onEdit) {
        if (navigator.vibrate) navigator.vibrate(50);
        onEdit(casino.id);
      }
    }, 600);
  };

  const endPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const copyToClipboard = (text: string | undefined, type: 'login' | 'pass' | 'referral') => {
    triggerHaptic();
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'login') {
      setCopiedLogin(true);
      setTimeout(() => setCopiedLogin(false), 2000);
    } else if (type === 'pass') {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } else {
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic();
    
    if (!casino.userReferralLink) return;

    const shareData = {
      title: `Join ${casino.name}`,
      text: `Sign up at ${casino.name} using my referral link!`,
      url: casino.userReferralLink
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.debug('Share cancelled');
      }
    } else {
      copyToClipboard(casino.userReferralLink, 'referral');
    }
  };

  if (activeFilter === 'referral' || activeFilter === 'daily') {
    return (
      <div 
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        className={`flex items-center justify-between p-5 rounded-[1.5rem] border shadow-sm relative overflow-hidden transition-all ${
           casino.isSignedUp 
             ? (activeFilter === 'daily' && isBonusReady ? 'bg-[#064e3b]/40 border-emerald-500/30' : 'bg-[#111] border-zinc-800') 
             : 'bg-zinc-950/50 border-zinc-900 opacity-80 hover:opacity-100'
        }`}
      >
        {/* Indicators */}
        {casino.isSignedUp && activeFilter === 'referral' && missingReferralLink && <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>}
        {casino.isSignedUp && activeFilter === 'referral' && referralConfigMismatch && <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>}
        {casino.isSignedUp && activeFilter === 'daily' && isBonusReady && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>}

        <div className="flex-1 min-w-0 pr-4 pl-2">
           <div className="flex items-center gap-2">
             {faviconUrl && (
                <img 
                  src={faviconUrl} 
                  alt="" 
                  className="w-4 h-4 rounded-full object-contain bg-white/5"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                />
             )}
             <h3 className={`text-sm font-black uppercase truncate tracking-wide ${casino.isSignedUp ? 'text-white' : 'text-zinc-500'}`}>
               {casino.name}
             </h3>
             {casino.isCustom && <span className="text-[9px] text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">Custom</span>}
             {activeFilter === 'referral' && missingReferralLink && (
               <button onClick={() => { triggerHaptic(); onEdit && onEdit(casino.id, 'referral'); }} className="animate-pulse">
                 <Icons.Alert size={14} className="text-amber-500" />
               </button>
             )}
             {activeFilter === 'referral' && referralConfigMismatch && <Icons.Error size={14} className="text-red-500 animate-pulse" />}
           </div>
           
           <div className="flex items-center gap-2 mt-1.5 ml-6">
              {!casino.isSignedUp ? (
                <span className="text-[10px] text-zinc-600 italic">Not joined yet</span>
              ) : (
                <>
                  {activeFilter === 'referral' && (
                    <>
                       {referralConfigMismatch ? (
                        <button 
                          onClick={() => { triggerHaptic(); onFixReferralMismatch && onFixReferralMismatch(casino.id); }}
                          className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded flex items-center gap-1 hover:bg-red-500/20 ripple"
                        >
                           <Icons.Config size={10} /> Enable Referral Status?
                        </button>
                      ) : (
                        <span className={`text-[10px] truncate max-w-[200px] ${casino.userReferralLink ? 'text-zinc-500' : 'text-zinc-700 italic'}`}>
                          {casino.userReferralLink ? casino.userReferralLink : 'No link set'}
                        </span>
                      )}
                    </>
                  )}
                  {activeFilter === 'daily' && (
                     <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isBonusReady ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`}>
                           {timerString || 'Loading...'}
                        </span>
                     </div>
                  )}
                </>
              )}
           </div>
        </div>

        <div>
          {!casino.isSignedUp ? (
             <button 
                onClick={() => { triggerHaptic(); onToggleJoined && onToggleJoined(casino.id, false); }}
                className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-zinc-800 text-zinc-500 hover:text-white hover:bg-emerald-600 transition-all active:scale-95 ripple"
             >
                Join
             </button>
          ) : (
             <>
               {activeFilter === 'referral' && (
                   <>
                       {!casino.userReferralLink ? (
                          <button 
                            onClick={() => { triggerHaptic(); onEdit && onEdit(casino.id, 'referral'); }}
                            className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-zinc-800 text-emerald-500 border border-zinc-700/50 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all active:scale-95 flex items-center gap-1.5 ripple"
                          >
                            + Link
                          </button>
                       ) : (
                          <button 
                            onClick={handleShare}
                            className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all active:scale-95 bg-purple-600 text-white shadow-purple-900/20 hover:bg-purple-500 ripple"
                          >
                            {copiedReferral ? 'Copied!' : 'Share'}
                            <Icons.Share size={14} strokeWidth={2.5} />
                          </button>
                       )}
                   </>
               )}
               {activeFilter === 'daily' && (
                  <div className="flex gap-2">
                    {isBonusReady && (
                        <a 
                          href={casino.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic();
                            if(onClaim) onClaim(casino.id);
                          }}
                          className="px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 transition-all active:scale-95 ripple"
                        >
                          Claim
                        </a>
                    )}
                    <button 
                        onClick={() => { triggerHaptic(); onOpenBonusSettings && onOpenBonusSettings(casino.id); }}
                        className="px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-zinc-800 text-blue-400 border border-zinc-700/50 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all active:scale-95 flex items-center gap-1.5 ripple"
                    >
                        <Icons.Config size={14} /> Rules
                    </button>
                  </div>
               )}
             </>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div 
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        className={`relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 select-none ${
          casino.isSignedUp 
            ? 'bg-[#1a1e26] border-emerald-500/30 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.05)]' 
            : 'bg-[#111111] border-zinc-800/60'
      }`}>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            {faviconUrl && (
                <img 
                  src={faviconUrl} 
                  alt="" 
                  className="w-4 h-4 rounded-full object-contain bg-white/5"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                />
            )}
            <h3 className={`text-xs font-black uppercase tracking-wide truncate ${casino.isSignedUp ? 'text-white' : 'text-zinc-400'}`}>
                {casino.name}
            </h3>
          </div>
          <div className="flex gap-2 mt-1.5 ml-6">
             {casino.hasDailyBonus && <div className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-1.5 rounded uppercase">Daily</div>}
             {casino.hasReferral && <div className="text-[9px] font-bold text-purple-500 bg-purple-500/10 px-1.5 rounded uppercase">Refer</div>}
             {casino.isCustom && <div className="text-[9px] font-bold text-orange-500 bg-orange-500/10 px-1.5 rounded uppercase">Custom</div>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => { triggerHaptic(); onToggleJoined && onToggleJoined(casino.id, casino.isSignedUp); }}
            className={`h-9 px-3 rounded-xl border flex items-center gap-2 transition-all active:scale-95 ripple ${
              casino.isSignedUp 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {casino.isSignedUp ? <Icons.Check size={14} strokeWidth={3} /> : <Icons.SignedUp size={14} />}
            <span className="text-[10px] font-black uppercase tracking-wider">{casino.isSignedUp ? 'Joined' : 'Join'}</span>
          </button>

          <a 
            href={casino.url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); triggerHaptic(); }}
            className="w-9 h-9 flex items-center justify-center bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-500 transition-all active:scale-95 ripple"
          >
            <Icons.Link size={14} />
          </a>
        </div>
      </div>
    );
  }

  // Standard Card
  return (
    <div 
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      className={`relative flex flex-col p-3 rounded-[1.5rem] border transition-all duration-300 elevation-1 group hover:elevation-4 select-none ${
      casino.isSignedUp 
        ? 'bg-[#1a1e26] border-emerald-500/20 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.03)]' 
        : 'bg-[#111111] border-zinc-800/80 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.02)]'
    }`}>
      
      <div className="flex items-center justify-between gap-3 mb-3 pl-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
             {faviconUrl && (
                <img 
                  src={faviconUrl} 
                  alt="" 
                  className="w-4 h-4 rounded-full object-contain bg-white/5"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                />
             )}
            <h3 className="text-[11px] font-black uppercase tracking-tight text-zinc-300 truncate flex-1">
            {casino.name} {casino.isCustom && <span className="text-[8px] text-orange-500 ml-1 opacity-70">CUSTOM</span>}
            </h3>
        </div>
        
        <a 
          href={casino.url} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic();
            if (casino.isSignedUp && casino.hasDailyBonus && onClaim) {
               onClaim(casino.id);
            }
          }}
          className="flex items-center justify-center gap-1.5 px-4 h-8 bg-gradient-to-br from-[#10B981] via-[#0EA874] to-[#059669] shadow-[0_2px_0_rgb(5,150,105),0_4px_10px_rgba(0,0,0,0.4)] btn-press-bright rounded-xl text-[10px] font-black text-white uppercase tracking-wider border border-white/20 active:translate-y-[1px] active:shadow-none ripple"
        >
          Open
          <Icons.Link size={10} strokeWidth={3} />
        </a>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <button 
          onClick={() => { triggerHaptic(); onToggleJoined && onToggleJoined(casino.id, casino.isSignedUp); }}
          title="Toggle Signed Up" 
          className={`h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95 ripple ${
            casino.isSignedUp 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-zinc-900/40 text-zinc-700 border-zinc-800/30 hover:border-zinc-600 hover:text-zinc-500'
          }`}
        >
          <Icons.SignedUp size={14} strokeWidth={2.5} />
        </button>
        <div title="Daily Bonus" className={`h-8 flex items-center justify-center rounded-lg border transition-all ${
            casino.hasDailyBonus 
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
              : 'bg-zinc-900/40 text-zinc-700 border-zinc-800/30'
          }`}>
          <Icons.Bonus size={14} strokeWidth={2.5} />
        </div>
        
        <div className="relative">
          {hasActionableReferralAlert ? (
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 triggerHaptic();
                 if (onEdit) onEdit(casino.id, 'referral');
               }}
               title="Referral Action Needed"
               className={`h-8 w-full flex items-center justify-center rounded-lg border transition-all active:scale-95 relative overflow-visible ripple ${
                 casino.hasReferral 
                   ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                   : 'bg-zinc-900/40 text-zinc-700 border-zinc-800/30'
               }`}
             >
               <Icons.Referral size={14} strokeWidth={2.5} />
               {missingReferralLink && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center animate-pulse border border-black shadow-md z-10">
                    <Icons.Alert size={10} className="text-black" strokeWidth={3} />
                  </div>
               )}
               {referralConfigMismatch && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center animate-pulse border border-black shadow-md z-10">
                    <Icons.Error size={10} className="text-black" strokeWidth={3} />
                  </div>
               )}
             </button>
          ) : (
            <div title="Referral" className={`h-8 flex items-center justify-center rounded-lg border transition-all ${
                casino.hasReferral 
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                  : 'bg-zinc-900/40 text-zinc-700 border-zinc-800/30'
              }`}>
              <Icons.Referral size={14} strokeWidth={2.5} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <button 
          onClick={() => copyToClipboard(casino.login, 'login')}
          disabled={!casino.login}
          className={`w-full flex items-center justify-between pl-3 pr-2 h-9 rounded-xl border text-[10px] font-bold transition-all btn-press-effect ripple ${
            casino.login 
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 group/btn' 
              : 'bg-zinc-900/30 border-zinc-800/30 text-zinc-700 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-2 truncate pr-2">
            <Icons.Account size={10} className="text-zinc-500 shrink-0" />
            <span className="truncate">{casino.login || 'No Login'}</span>
          </div>
          {casino.login && (
             copiedLogin 
               ? <Icons.Check size={12} className="text-emerald-500 animate-in zoom-in spin-in-90 duration-300" />
               : <Icons.Copy size={12} className="text-zinc-600 group-hover/btn:text-zinc-400 transition-colors" />
          )}
        </button>

        <div className="flex gap-2 h-9">
           <button 
            onClick={() => copyToClipboard(casino.password, 'pass')}
            disabled={!casino.password}
            className={`flex-1 flex items-center justify-between pl-3 pr-2 rounded-xl border text-[10px] font-bold transition-all btn-press-effect ripple ${
              casino.password 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 group/btn' 
                : 'bg-zinc-900/30 border-zinc-800/30 text-zinc-700 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Icons.Lock size={10} className="text-zinc-500 shrink-0" />
              <span className="truncate tracking-widest">{casino.password ? '••••••' : 'Empty'}</span>
            </div>
            {casino.password && (
              copiedPass
               ? <Icons.Check size={12} className="text-emerald-500 animate-in zoom-in spin-in-90 duration-300" />
               : <Icons.Copy size={12} className="text-zinc-600 group-hover/btn:text-zinc-400 transition-colors" />
            )}
          </button>

          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerHaptic();
              onEdit && onEdit(casino.id);
            }}
            className="w-9 h-9 flex items-center justify-center bg-zinc-800/40 text-zinc-500 border border-zinc-700/40 rounded-xl hover:text-white hover:bg-zinc-700/60 hover:border-zinc-600 transition-all active:scale-95 ripple"
          >
            <Icons.Config size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
