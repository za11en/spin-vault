
import React, { useState, useEffect, useRef } from 'react';
import { Casino, BonusConfig } from '../types';
import { Icons } from './Icon';

interface EditCasinoModalProps {
  casino: Casino;
  canEditGlobal?: boolean;
  initialFocus?: 'referral' | null;
  initialTab?: 'credentials' | 'bonus';
  onSave: (updated: Casino) => void;
  onClose: () => void;
}

export const CredentialModal: React.FC<EditCasinoModalProps> = ({ 
  casino, 
  canEditGlobal = false, 
  initialFocus, 
  initialTab = 'credentials',
  onSave, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'bonus'>(initialTab);
  const [login, setLogin] = useState(casino.login || '');
  const [pass, setPass] = useState(casino.password || '');
  const [referralLink, setReferralLink] = useState(casino.userReferralLink || '');
  const [isSignedUp, setIsSignedUp] = useState(casino.isSignedUp);
  const [hasDailyBonus, setHasDailyBonus] = useState(casino.hasDailyBonus);
  const [hasReferral, setHasReferral] = useState(casino.hasReferral);
  const [showPass, setShowPass] = useState(false);
  const [bonusConfig, setBonusConfig] = useState<BonusConfig>(casino.bonusConfig || { type: 'rolling', cooldownHours: 24, resetTime: '00:00' });
  const referralInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFocus === 'referral' && activeTab === 'credentials' && referralInputRef.current) {
      setTimeout(() => referralInputRef.current?.focus(), 100);
    }
  }, [initialFocus, activeTab]);

  useEffect(() => {
    if (!hasDailyBonus && activeTab === 'bonus') {
      setActiveTab('credentials');
    }
  }, [hasDailyBonus, activeTab]);

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleSave = () => {
    triggerHaptic();
    onSave({
      ...casino,
      login: canEditGlobal ? casino.login : login,
      password: canEditGlobal ? casino.password : pass,
      isSignedUp: canEditGlobal ? casino.isSignedUp : isSignedUp,
      userReferralLink: canEditGlobal ? casino.userReferralLink : referralLink,
      hasDailyBonus,
      hasReferral,
      bonusConfig: bonusConfig 
    });
  };

  const referralMismatch = !!referralLink && !hasReferral;
  const missingReferralLink = isSignedUp && hasReferral && !referralLink;
  const showReferralError = referralMismatch || missingReferralLink;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg overflow-hidden animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800/60 rounded-[2.5rem] elevation-5 overflow-hidden animate-in slide-in-from-bottom-8 zoom-in-95 duration-500">
        
        <div className="px-8 py-6 border-b border-zinc-800/40 bg-zinc-900/20 flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <h2 className="text-[16px] font-black uppercase tracking-tight text-white truncate drop-shadow-sm">{casino.name}</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Settings Manager</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 text-zinc-400 btn-press-effect bg-zinc-900 border border-zinc-800 rounded-full hover:text-white shrink-0 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.05)]"
          >
            <Icons.Clear size={18} />
          </button>
        </div>

        {hasDailyBonus && (
          <div className="flex px-8 pt-6 pb-0 gap-2">
             <button 
               onClick={() => { triggerHaptic(); setActiveTab('credentials'); }}
               className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${activeTab === 'credentials' ? 'bg-zinc-800 text-white border-zinc-700 shadow-sm' : 'bg-zinc-900/50 text-zinc-600 border-zinc-800/50 hover:bg-zinc-900 hover:text-zinc-400'}`}
             >
               Credentials
             </button>
             <button 
               onClick={() => { triggerHaptic(); setActiveTab('bonus'); }}
               className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${activeTab === 'bonus' ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-sm' : 'bg-zinc-900/50 text-zinc-600 border-zinc-800/50 hover:bg-zinc-900 hover:text-zinc-400'}`}
             >
               Daily Bonus
             </button>
          </div>
        )}
        
        <div className="p-8 space-y-6 min-h-[380px]">
          {activeTab === 'credentials' ? (
            <>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Tracking Status</label>
                
                <button 
                  disabled={canEditGlobal}
                  onClick={() => { triggerHaptic(); setIsSignedUp(!isSignedUp); }}
                  className={`flex items-center justify-between w-full h-14 px-5 rounded-2xl border-2 transition-all duration-200 btn-press-effect elevation-1 ${
                    isSignedUp ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  } ${canEditGlobal ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3 font-black text-sm uppercase">
                    <Icons.SignedUp size={20} strokeWidth={3} />
                    Joined
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${isSignedUp ? 'bg-emerald-500 border-emerald-400 elevation-2' : 'border-zinc-700'}`} />
                </button>

                {canEditGlobal && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                    <button 
                      onClick={() => { triggerHaptic(); setHasDailyBonus(!hasDailyBonus); }}
                      className={`flex items-center justify-between h-14 px-4 rounded-2xl border-2 transition-all duration-200 btn-press-effect elevation-1 ${
                        hasDailyBonus ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-black text-[10px] uppercase">
                        <Icons.Bonus size={18} strokeWidth={3} />
                        Daily
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${hasDailyBonus ? 'bg-blue-500 border-blue-400 elevation-1' : 'border-zinc-700'}`} />
                    </button>

                    <button 
                      onClick={() => { triggerHaptic(); setHasReferral(!hasReferral); }}
                      className={`flex items-center justify-between h-14 px-4 rounded-2xl border-2 transition-all duration-200 btn-press-effect elevation-1 ${
                        hasReferral ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-black text-[10px] uppercase">
                        <Icons.Referral size={18} strokeWidth={3} />
                        Refer
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 ${hasReferral ? 'bg-purple-500 border-purple-400 elevation-1' : 'border-zinc-700'}`} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Access Credentials</label>
                <div className={`relative group ${canEditGlobal ? 'opacity-50' : ''}`}>
                  <Icons.Account size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" />
                  <input
                    disabled={canEditGlobal}
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full h-14 bg-zinc-900 border-2 border-zinc-800/80 rounded-2xl pl-14 pr-4 text-sm font-bold focus:bg-zinc-800 focus:border-zinc-600 outline-none text-white placeholder:text-zinc-700 transition-all elevation-1 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.03)]"
                    placeholder="User / Email"
                  />
                </div>

                <div className={`relative group ${canEditGlobal ? 'opacity-50' : ''}`}>
                  <Icons.Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" />
                  <input
                    disabled={canEditGlobal}
                    type={showPass ? "text" : "password"}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full h-14 bg-zinc-900 border-2 border-zinc-800/80 rounded-2xl pl-14 pr-16 text-sm font-bold focus:bg-zinc-800 focus:border-zinc-600 outline-none text-white placeholder:text-zinc-700 transition-all elevation-1 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.03)]"
                    placeholder="Password"
                  />
                  <button 
                    disabled={canEditGlobal}
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white btn-press-effect"
                  >
                    {showPass ? <Icons.Hide size={20} /> : <Icons.Show size={20} />}
                  </button>
                </div>

                 <div className={`relative group ${canEditGlobal ? 'opacity-50' : ''}`}>
                  <Icons.Link size={18} className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${initialFocus === 'referral' ? 'text-amber-500 animate-pulse' : showReferralError ? (referralMismatch ? 'text-red-500' : 'text-amber-500') : 'text-zinc-500 group-focus-within:text-amber-500'}`} />
                  
                  {referralMismatch && <Icons.Error size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 animate-pulse" />}
                  {missingReferralLink && <Icons.Alert size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 animate-pulse" />}

                  <input
                    ref={referralInputRef}
                    disabled={canEditGlobal}
                    type="text"
                    value={referralLink}
                    onChange={(e) => setReferralLink(e.target.value)}
                    className={`w-full h-14 bg-zinc-900 border-2 rounded-2xl pl-14 pr-10 text-sm font-bold outline-none text-white placeholder:text-zinc-700 transition-all elevation-1 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.03)] ${
                      showReferralError
                        ? (referralMismatch ? 'border-red-500/80 shadow-[0_0_15px_rgba(220,38,38,0.1)] focus:border-red-500' : 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.1)] focus:border-amber-500')
                        : initialFocus === 'referral' 
                          ? 'border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                          : 'border-zinc-800/80 focus:bg-zinc-800 focus:border-amber-500/50'
                    }`}
                    placeholder="My Referral Link"
                  />
                </div>
              </div>
            </>
          ) : (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => { triggerHaptic(); setBonusConfig(prev => ({ ...prev, type: 'rolling' })); }}
                      className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${bonusConfig.type === 'rolling' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Rolling (Hours)
                    </button>
                    <button 
                      onClick={() => { triggerHaptic(); setBonusConfig(prev => ({ ...prev, type: 'fixed' })); }}
                      className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${bonusConfig.type === 'fixed' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Fixed (Time)
                    </button>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                        {bonusConfig.type === 'rolling' ? 'Cooldown Period (Hours)' : 'Reset Time (24h Format)'}
                    </label>
                    
                    {bonusConfig.type === 'rolling' ? (
                        <div className="relative">
                            <Icons.Daily size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
                            <input 
                                type="number" 
                                min="1"
                                max="168"
                                value={bonusConfig.cooldownHours || 24}
                                onChange={(e) => setBonusConfig(prev => ({ ...prev, cooldownHours: parseInt(e.target.value) || 24 }))}
                                className="w-full h-14 bg-zinc-900 border-2 border-zinc-800 rounded-2xl pl-12 pr-4 text-white font-bold outline-none focus:border-blue-500 transition-all shadow-[inset_1px_1px_0px_rgba(255,255,255,0.03)]"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">HRS</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <Icons.Daily size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
                            <input 
                                type="time" 
                                value={bonusConfig.resetTime || "00:00"}
                                onChange={(e) => setBonusConfig(prev => ({ ...prev, resetTime: e.target.value }))}
                                className="w-full h-14 bg-zinc-900 border-2 border-zinc-800 rounded-2xl pl-12 pr-4 text-white font-bold outline-none focus:border-blue-500 transition-all shadow-[inset_1px_1px_0px_rgba(255,255,255,0.03)] [color-scheme:dark]"
                            />
                        </div>
                    )}
                </div>
                
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-center">
                   <p className="text-[10px] text-blue-400/80 leading-relaxed font-medium">
                      {bonusConfig.type === 'rolling' 
                        ? `Timer resets ${bonusConfig.cooldownHours || 24} hours after you mark it as claimed.`
                        : `Timer resets automatically every day at ${bonusConfig.resetTime || '00:00'}.`
                      }
                   </p>
                </div>
             </div>
          )}
        </div>

        <div className="p-8 pt-4 bg-zinc-900/40 flex gap-4 border-t border-zinc-800/50">
          <button 
            onClick={onClose}
            className="flex-1 h-14 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 btn-press-effect border border-zinc-800 rounded-2xl bg-zinc-900 hover:text-zinc-200 active:elevation-0 elevation-1 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.05)]"
          >
            Discard
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 h-14 rounded-2xl bg-emerald-600 text-[11px] font-black uppercase tracking-[0.2em] text-white btn-press-bright elevation-3 border border-emerald-400/30 active:elevation-1 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.15)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
