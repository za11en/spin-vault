
import React, { useState, useMemo } from 'react';
import { Casino } from '../types';
import { Icons } from './Icon';

interface GlobalConfigProps {
  casinos: Casino[];
  onUpdateGlobal: (id: string, type: 'daily' | 'referral', value: boolean | null) => void;
  onClose: () => void;
}

export const GlobalConfig: React.FC<GlobalConfigProps> = ({ casinos, onUpdateGlobal, onClose }) => {
  const [search, setSearch] = useState('');

  const filteredCasinos = useMemo(() => {
    return casinos.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [casinos, search]);

  const systemCasinos = useMemo(() => filteredCasinos.filter(c => !c.isCustom), [filteredCasinos]);
  const customCasinos = useMemo(() => filteredCasinos.filter(c => c.isCustom), [filteredCasinos]);

  const getStateColor = (state: boolean | null, type: 'daily' | 'referral') => {
    if (state === null) return 'bg-zinc-800 border-zinc-700 text-zinc-500'; // Unknown
    if (state === false) return 'bg-zinc-950 border-zinc-800 text-red-900/40'; // No
    if (type === 'daily') return 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]';
    return 'bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]';
  };

  const getStateLabel = (state: boolean | null) => {
    if (state === null) return '?';
    if (state === false) return 'NO';
    return 'YES';
  };

  const getFaviconUrl = (url: string) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
        return null;
    }
  };

  const renderCasinoRow = (casino: Casino) => {
    const faviconUrl = getFaviconUrl(casino.url);
    const hostname = (() => {
        try { return new URL(casino.url).hostname.replace('www.', ''); } catch { return casino.url; }
    })();

    return (
      <div key={casino.id} className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-zinc-900 rounded-2xl hover:border-zinc-800 transition-colors group">
        <div className="flex-1 min-w-0 pr-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-zinc-700 transition-colors">
             {faviconUrl ? (
                 <img 
                    src={faviconUrl} 
                    alt="" 
                    className="w-6 h-6 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                 />
             ) : (
                 <Icons.Link size={16} className="text-zinc-700" />
             )}
          </div>
          
          <div className="min-w-0">
            <h3 className="text-xs font-black uppercase text-zinc-300 truncate flex items-center gap-2 group-hover:text-white transition-colors">
                {casino.name} 
                {casino.isCustom && <span className="text-[8px] text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">CUSTOM</span>}
            </h3>
            <a href={casino.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-zinc-600 truncate hover:text-emerald-500 flex items-center gap-1 mt-0.5 transition-colors">
              {hostname} <Icons.Link size={8} />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Daily Toggle */}
          <div className="flex flex-col items-center gap-1.5 w-12">
              <span className={`text-[8px] font-bold uppercase tracking-wider ${casino.hasDailyBonus === true ? 'text-blue-400' : 'text-zinc-600'}`}>Daily</span>
              <button 
                onClick={() => onUpdateGlobal(casino.id, 'daily', !casino.hasDailyBonus)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${getStateColor(casino.hasDailyBonus, 'daily')}`}
              >
                  <Icons.Daily size={16} strokeWidth={3} />
              </button>
          </div>

          <div className="w-px h-8 bg-zinc-800/50"></div>

          {/* Referral Toggle */}
           <div className="flex flex-col items-center gap-1.5 w-12">
              <span className={`text-[8px] font-bold uppercase tracking-wider ${casino.hasReferral === true ? 'text-purple-400' : 'text-zinc-600'}`}>Refer</span>
              <button 
                  onClick={() => onUpdateGlobal(casino.id, 'referral', !casino.hasReferral)}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${getStateColor(casino.hasReferral, 'referral')}`}
              >
                  <Icons.Referral size={16} strokeWidth={3} />
              </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[190] bg-black animate-in fade-in duration-300 flex flex-col">
       {/* Modal Header */}
       <div className="px-6 py-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md">
         <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white italic">System Config</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Global Database Settings</p>
         </div>
         <button onClick={onClose} className="p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all btn-press-effect">
            <Icons.Clear size={20} />
         </button>
       </div>

       {/* Search Bar */}
       <div className="p-4 border-b border-zinc-900 bg-zinc-950/30">
          <div className="relative group">
            <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search database..." 
              className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-emerald-500 transition-all placeholder:font-medium placeholder:text-zinc-600"
            />
          </div>
       </div>

       {/* List Content */}
       <div className="flex-1 overflow-y-auto p-4 space-y-8 no-scrollbar">
          {systemCasinos.length > 0 && (
            <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 pl-2">System Casinos</h3>
                <div className="space-y-2">
                    {systemCasinos.map(renderCasinoRow)}
                </div>
            </div>
          )}

          {customCasinos.length > 0 && (
            <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-900/60 pl-2">User Added</h3>
                <div className="space-y-2">
                    {customCasinos.map(renderCasinoRow)}
                </div>
            </div>
          )}

          {filteredCasinos.length === 0 && (
            <div className="text-center py-20 opacity-50">
                <p className="text-xs uppercase font-bold text-zinc-500">No casinos found</p>
            </div>
          )}
       </div>
    </div>
  );
};
