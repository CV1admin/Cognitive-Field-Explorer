
import React, { useState, useEffect, useCallback } from 'react';
import { InformationField, createPacket, CentroidOperator, HierarchyOperator } from './services/fieldService';
import { analyzeFieldPatterns, generateSyntheticObservation } from './services/geminiService';
import { InfoPacket, SimSelf, EpistemicStatus } from './types';
import FieldVisualizer from './components/FieldVisualizer';
import PacketCard from './components/PacketCard';

const App: React.FC = () => {
  const [field] = useState(() => new InformationField());
  const [packets, setPackets] = useState<InfoPacket[]>([]);
  const [self, setSelf] = useState<SimSelf>({
    identity: "Observer-1",
    vars: { arousal: 0.35, curiosity: 0.5, stability: 1.0 }
  });
  const [step, setStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [aiReport, setAiReport] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [epistemic, setEpistemic] = useState<EpistemicStatus>({
    innovationError: 0,
    diversity: 1,
    coherence: 1,
    recursionDominance: 0,
    volatility: 0,
    healthIndex: 1
  });

  // Ignition State
  const [ignitionStepsRemaining, setIgnitionStepsRemaining] = useState(0);
  const [recursionStallCount, setRecursionStallCount] = useState(0);

  const log = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50));
  };

  const triggerIgnition = () => {
    if (ignitionStepsRemaining > 0) return;
    log("!!! IGNITION SEQUENCE INITIATED !!!");
    setIgnitionStepsRemaining(15);
    
    // Step 1: Immediate Override
    setSelf(prev => ({
      ...prev,
      vars: { ...prev.vars, arousal: 0.50, curiosity: 0.80 }
    }));

    // Step 3: Emit Quarantined Probes
    for (let i = 0; i < 3; i++) {
      const probe = createPacket({
        kind: 'observation',
        payload: { type: 'active_probe', id: i },
        embedding: [
          Math.max(0, Math.min(1, Math.random() * 0.4 + 0.3)), 
          Math.max(0, Math.min(1, Math.random() * 0.4 + 0.3))
        ] as [number, number],
        tags: ['curiosity', 'self_initiated', 'probe', 'quarantine', 'observation'],
        confidence: 0.20,
        meta: { ignition: true }
      });
      field.put(probe);
    }
  };

  const runStep = useCallback(async () => {
    setStep(s => s + 1);

    // 1. Observation Generation
    const isAiStep = Math.random() > 0.95;
    let newObs;
    if (isAiStep) {
      log("Initiating AI-driven observation...");
      newObs = await generateSyntheticObservation();
    } else {
      const drift = Math.sin(step * 0.1) * 0.05;
      newObs = {
        payload: { signal: (Math.random() * 100).toFixed(2), type: 'sensor' },
        embedding: [Math.max(0, Math.min(1, Math.random() * 0.2 + 0.4 + drift)), Math.random()] as [number, number],
        tags: ['sensor']
      };
    }

    const obsPacket = createPacket({
      kind: 'observation',
      payload: newObs.payload,
      embedding: newObs.embedding,
      tags: [...newObs.tags, 'observation'],
      confidence: 0.8 + Math.random() * 0.2,
      meta: { step }
    });
    field.put(obsPacket);

    // 2. Diagnostics
    const eps_t = field.calculateInnovationError(obsPacket);
    const n_eff = field.calculateDiversity(32);
    const s_t_raw = Math.random() * 0.08; 
    const coherence = 1 - s_t_raw;
    const r_t = field.calculateRecursionDominance(32);
    const v_t = field.calculateVolatility(10);

    // Recursion Guard Logic
    if (r_t > 0.65) {
      setRecursionStallCount(c => c + 1);
    } else {
      setRecursionStallCount(0);
    }

    // 3. Adaptive Arousal Rule
    let nextArousal = self.vars.arousal;
    const isIgniting = ignitionStepsRemaining > 0;

    if (isIgniting) {
      setIgnitionStepsRemaining(prev => prev - 1);
      // Locked at 0.50 per supervisor instruction, but we'll let it drift within [0.2, 0.7] if ignition logic allows
      nextArousal = 0.50;
    } else {
      // a_{t+1} = clip(a_t + 0.10*eps_t + 0.05*v_t - 0.12*S_t - 0.15*r_t, 0.20, 0.70)
      const delta = (0.10 * eps_t) + (0.05 * v_t) - (0.12 * s_t_raw) - (0.15 * r_t);
      nextArousal = Math.max(0.20, Math.min(0.70, nextArousal + delta));
      
      // Recursion Guard Clamp
      if (recursionStallCount > 5) {
        log("Recursion dominance guard active: clamping arousal.");
        nextArousal = Math.max(0.20, nextArousal - 0.15);
      }
    }

    // KILL SWITCH
    if (isIgniting && (s_t_raw > 0.15 || r_t > 0.70 || (Math.exp(-2.0 * eps_t) * (1 - r_t * 0.5) < 0.15))) {
      log("!!! IGNITION KILL-SWITCH TRIGGERED !!! Divergence detected.");
      setIgnitionStepsRemaining(0);
      nextArousal = 0.30;
    }

    setSelf(prev => ({
      ...prev,
      vars: { ...prev.vars, arousal: nextArousal }
    }));

    // 4. Combined Health Index (H_t)
    const alpha = 2.0;
    const beta = 1.0;
    const gamma = 5.0;
    const n0 = 1.2;
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    const health = Math.exp(-alpha * eps_t) * 
                   sigmoid(beta * (n_eff - n0)) * 
                   Math.exp(-gamma * s_t_raw) *
                   (1 - r_t * 0.5);

    setEpistemic({
      innovationError: eps_t,
      diversity: n_eff,
      coherence: coherence,
      recursionDominance: r_t,
      volatility: v_t,
      healthIndex: health
    });

    // 5. Operators
    const opCtx = { step, budget: { entropy: 10 }, meta: { isIgniting } };
    
    if (CentroidOperator.applicable(field)) {
      const res = CentroidOperator.run(field, opCtx);
      res.produced.forEach(p => field.put(p));
    }

    if (HierarchyOperator.applicable(field, isIgniting)) {
      const res = HierarchyOperator.run(field, opCtx);
      res.produced.forEach(p => field.put(p));
      res.notes.forEach(n => log(n));
    }

    // 6. Trace & Self-Model
    if (step % 5 === 0) {
      field.put(createPacket({
        kind: 'self_model',
        payload: { vars: { ...self.vars, arousal: nextArousal }, healthIndex: health, isIgniting },
        tags: ['self', 'model'],
        confidence: 0.99,
        meta: { step }
      }));
    }

    setPackets(field.getLatest(20));
  }, [field, step, self, ignitionStepsRemaining, recursionStallCount]);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(runStep, 1200);
    }
    return () => clearInterval(interval);
  }, [isRunning, runStep]);

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    const report = await analyzeFieldPatterns(field.getLatest(30));
    setAiReport(report);
    setIsAiLoading(false);
    log("AI Analysis cycle completed.");
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans text-slate-200">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <i className="fas fa-microchip text-white text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-tight bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Epistemic Field Engine
            </h1>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Recursive Cognition v2.2</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {epistemic.healthIndex < 0.35 && (
            <button 
              onClick={triggerIgnition}
              disabled={ignitionStepsRemaining > 0 || !isRunning}
              className={`px-4 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all border shadow-lg ${ignitionStepsRemaining > 0 ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 animate-pulse' : 'bg-amber-600/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30 shadow-amber-900/20'}`}
            >
              {ignitionStepsRemaining > 0 ? `Ignition active (${ignitionStepsRemaining})` : 'Ignite Core'}
            </button>
          )}

          <div className="flex flex-col items-end border-l border-white/10 pl-4">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">System Vitality</span>
            <div className="flex items-center gap-2">
               <span className="text-xs font-mono text-emerald-400">{(epistemic.healthIndex * 100).toFixed(1)}%</span>
               <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-700 ${epistemic.healthIndex > 0.7 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : epistemic.healthIndex > 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                  style={{ width: `${epistemic.healthIndex * 100}%` }}
                />
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 border ${isRunning ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 shadow-inner' : 'bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-600/20'}`}
          >
            <i className={`fas ${isRunning ? 'fa-pause' : 'fa-play'}`}></i>
            {isRunning ? 'HALT' : 'IGNITE'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Substrate Column */}
        <section className="w-80 border-r border-white/5 flex flex-col glass overflow-hidden shadow-2xl z-20">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h2 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400">
              <i className="fas fa-database text-indigo-500"></i>
              Information Archive
            </h2>
            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 font-mono">
              {field.getSize()} PKTS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {packets.map((p) => (
              <PacketCard key={p.id} packet={p} />
            ))}
          </div>
        </section>

        {/* Center Canvas */}
        <section className="flex-1 flex flex-col bg-slate-900/50 relative">
          <div className="p-4 border-b border-white/5 flex items-center justify-between z-10 bg-slate-950/40 backdrop-blur-md">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Innovation (εₜ)</span>
                <span className={`text-xl font-mono ${epistemic.innovationError > 0.4 ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {epistemic.innovationError.toFixed(4)}
                </span>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-8">
                <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Arousal (Adaptive)</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-mono ${self.vars.arousal > 0.6 ? 'text-rose-400' : 'text-indigo-400'}`}>
                    {self.vars.arousal.toFixed(3)}
                  </span>
                  {ignitionStepsRemaining > 0 && <span className="text-[8px] text-amber-500 animate-pulse font-black uppercase">Ignition Gated</span>}
                </div>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-8">
                <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Recursion Guard</span>
                <span className={`text-xl font-mono ${recursionStallCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {recursionStallCount}/5
                </span>
              </div>
            </div>
            <button 
              onClick={handleAiAnalysis}
              disabled={isAiLoading}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-white/10 text-indigo-300 hover:bg-indigo-500/10 text-xs font-bold transition-all flex items-center gap-2 shadow-inner group"
            >
              {isAiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-brain"></i>}
              PATTERN AUDIT
            </button>
          </div>
          
          <div className="flex-1 relative overflow-hidden">
            <FieldVisualizer packets={packets} latestInnovation={epistemic.innovationError} />
            
            {aiReport && (
              <div className="absolute top-4 right-4 w-80 glass rounded-2xl border border-indigo-500/40 p-5 shadow-2xl animate-in fade-in zoom-in duration-300 z-20 backdrop-blur-2xl bg-slate-950/60">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-2 tracking-widest">
                    <i className="fas fa-shimmer"></i>
                    Epistemic Insight
                  </h3>
                  <button onClick={() => setAiReport("")} className="text-slate-500 hover:text-white transition-colors">
                    <i className="fas fa-times-circle"></i>
                  </button>
                </div>
                <div className="text-xs leading-relaxed text-slate-300 font-medium italic max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {aiReport}
                </div>
              </div>
            )}
          </div>

          <div className="h-44 border-t border-white/5 bg-slate-950/90 p-4 font-mono text-[10px] overflow-hidden flex flex-col z-10">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-1">
              <div className="flex items-center gap-2 text-slate-500 uppercase tracking-widest font-black opacity-60">
                <i className="fas fa-terminal"></i> Kernel Output
              </div>
              <div className="text-[9px] text-slate-600 font-mono">STEP T+{step.toString().padStart(4, '0')}</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar select-none opacity-80 hover:opacity-100 transition-opacity">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3 items-baseline border-l border-white/5 pl-3 group">
                  <span className={`text-[8px] font-bold ${i === 0 ? 'text-indigo-400 animate-pulse' : 'text-slate-700'}`}>0x{i.toString(16).padStart(2, '0')}</span>
                  <span className={l.includes('Operator') ? 'text-emerald-500' : l.includes('AI') ? 'text-indigo-400' : l.includes('!!!') ? 'text-rose-500 font-black' : 'text-slate-400'}>
                    {l}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Status Panel */}
        <section className="w-80 border-l border-white/5 glass flex flex-col overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/5 bg-white/5">
            <h2 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400">
              <i className="fas fa-microchip text-cyan-400"></i>
              System Diagnostics
            </h2>
          </div>
          <div className="p-5 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
            <div className="space-y-6">
              {/* Surprise */}
              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Innovation (εₜ)</span>
                  <span className={`text-xs font-mono font-bold ${epistemic.innovationError > 0.4 ? 'text-rose-400' : 'text-cyan-400'}`}>
                    {(epistemic.innovationError).toFixed(3)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full border border-white/5 p-[1px]">
                  <div className={`h-full rounded-full transition-all duration-500 ${epistemic.innovationError > 0.4 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-cyan-500'}`} style={{ width: `${Math.min(100, epistemic.innovationError * 200)}%` }}></div>
                </div>
              </div>

              {/* Diversity */}
              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Diversity (Nₑff)</span>
                  <span className={`text-xs font-mono font-bold ${epistemic.diversity < 1.2 ? 'text-amber-400' : 'text-purple-400'}`}>
                    {epistemic.diversity.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full border border-white/5 p-[1px]">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]" style={{ width: `${Math.min(100, (epistemic.diversity / 5) * 100)}%` }}></div>
                </div>
              </div>

              {/* Coherence */}
              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coherence (Sₜ)</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {(epistemic.coherence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full border border-white/5 p-[1px]">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${epistemic.coherence * 100}%` }}></div>
                </div>
              </div>

              {/* Recursion Dominance */}
              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recursion (Rₜ)</span>
                  <span className={`text-xs font-mono font-bold ${epistemic.recursionDominance > 0.6 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {(epistemic.recursionDominance * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full border border-white/5 p-[1px]">
                  <div className={`h-full rounded-full transition-all duration-500 ${epistemic.recursionDominance > 0.6 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]' : 'bg-slate-600'}`} style={{ width: `${epistemic.recursionDominance * 100}%` }}></div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex flex-col gap-4 shadow-inner">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                   <i className="fas fa-shield-halved"></i>
                   Decision Policy
                </span>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight">Consolidation</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${ignitionStepsRemaining > 0 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                    {ignitionStepsRemaining > 0 ? 'HIERARCHICAL' : 'NORMAL'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight">Arousal Controller</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${ignitionStepsRemaining > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                    {ignitionStepsRemaining > 0 ? 'IGNITION LOCKED' : 'DIAGNOSTIC GATED'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight">Imagination Guard</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${ignitionStepsRemaining > 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                    {ignitionStepsRemaining > 0 ? 'QUARANTINE ACTIVE' : 'NOMINAL'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 pb-4">
              <div className="text-[9px] text-slate-500 italic bg-slate-900/30 p-4 rounded-xl border border-white/5 leading-relaxed tracking-wide shadow-inner">
                "Multiple resolution re-clustering authorized during ignition. Macro-layer navigation map created without pruning micro-representation."
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
