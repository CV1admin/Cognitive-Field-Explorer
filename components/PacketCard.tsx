
import React from 'react';
import { InfoPacket } from '../types';

interface PacketCardProps {
  packet: InfoPacket;
}

const PacketCard: React.FC<PacketCardProps> = ({ packet }) => {
  const getKindColor = () => {
    switch (packet.kind) {
      case 'observation': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5';
      case 'summary': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
      case 'self_model': return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5';
      case 'trace': return 'text-slate-400 border-slate-500/30 bg-slate-500/5';
      default: return 'text-slate-300 border-white/10 bg-white/5';
    }
  };

  const getIcon = () => {
    switch (packet.kind) {
      case 'observation': return 'fa-eye';
      case 'summary': return 'fa-compress-arrows-alt';
      case 'self_model': return 'fa-id-card';
      case 'trace': return 'fa-history';
      default: return 'fa-cube';
    }
  };

  return (
    <div className={`p-3 rounded-xl border transition-all duration-300 hover:border-white/20 hover:bg-white/10 group ${getKindColor()}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <i className={`fas ${getIcon()} text-xs`}></i>
          <span className="text-[10px] font-bold uppercase tracking-widest">{packet.kind}</span>
        </div>
        <span className="text-[9px] font-mono opacity-50">{packet.id.slice(0, 6)}</span>
      </div>
      
      <div className="text-[11px] mb-2 line-clamp-2 text-slate-200">
        {typeof packet.payload === 'object' ? JSON.stringify(packet.payload) : packet.payload}
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {packet.tags.map(tag => (
          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 opacity-70">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 opacity-40 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          <i className="fas fa-check-circle text-[9px]"></i>
          <span className="text-[9px]">Conf: {(packet.confidence * 100).toFixed(0)}%</span>
        </div>
        <span className="text-[9px]">{new Date(packet.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
};

export default PacketCard;
