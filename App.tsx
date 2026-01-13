
import React, { useState, useEffect, useCallback } from 'react';
import { InformationField, createPacket, CentroidOperator } from './services/fieldService';
import { analyzeFieldPatterns, generateSyntheticObservation } from './services/geminiService';
import { InfoPacket, SimSelf, EpistemicStatus } from './types';
import FieldVisualizer from './components/FieldVisualizer';
import PacketCard from './components/PacketCard';

const App: React.FC = () => {
  const [field] = useState(() => new InformationField());
  const [packets, setPackets] = useState<InfoPacket[]>([]);
  const [self, setSelf] = useState<SimSelf>({
    identity: "Observer-1",
    vars: { arousal: 0.2, curiosity: 0.5, stability: 1.0 }
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
    healthIndex: 1
  });

  const log = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50));
  };

  const runStep = useCallback(async () => {
    setStep(s => s + 1);

    // 1. Observation
    const isAiStep = Math.random() > 0.9;
    let newObs;
    if (isAiStep) {
      log("Initiating AI-driven observation...");
      newObs = await generateSyntheticObservation();
    } else {
      newObs = {
        payload: { signal: (Math.random() * 100).toFixed(2), type: 'sensor' },
        embedding: [Math.random(), Math.random()] as [number, number],
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

    // 2. Innovation Error Calculation
    const eps_t = field.calculateInnovationError(obsPacket);

    // 3. Operators
    if (CentroidOperator.applicable(field)) {
      const res = CentroidOperator.run(field, { step, budget: { entropy: 10 }, meta: {} });
      res.produced.forEach(p => field.put(p));
      res.notes.forEach(n => log(`Operator: ${n}`));
    }

    // 4. Epistemic Metrics Computation
    const n_eff = field.calculateDiversity(32);
    const s_t_raw = Math.random() * 0.1; // Simulated raw inconsistency
    const coherence = 1 - s_t_raw;

    // Formula: H_t = exp(-a * eps_t) * sigma(b * (n_eff - n0)) * exp(-g * s_t)
    const alpha = 2.0;
    const beta = 1.0;
    const gamma = 5.0;
    const n0 = 1.5;
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    
    const health = Math.exp(-alpha * eps_t) * 
                   sigmoid(beta * (n_eff - n0)) * 
                   Math.exp(-gamma * s_t_raw);

    setEpistemic({
      innovationError: eps_t,
      diversity: n_eff,
      coherence: coherence,
      healthIndex: health
    });

    // 5. Self-Model Update
    if (step % 5 === 0) {
      const selfPacket = createPacket({
        kind: 'self_model',
        payload: { ...self, healthIndex: health },
        tags: ['self', 'model'],
        confidence: 0.99,
        meta: { step }
      });
      field.put(selfPacket);
    }

    setPackets(field.getLatest(20));
  }, [field, step, self]);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(runStep, 1500);
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
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <i className="fas fa-microchip text-white text-lg"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-tight bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              Epistemic Field Engine
            </h1>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Recursive Cognition v2.0</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Core Health Index</span>
            <div className="flex items-center gap-3">
               <span className="text-xs font-mono text-emerald-400">{(epistemic.healthIndex * 100).toFixed(1)}%</span>
               <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-700 ${epistemic.healthIndex > 0.7 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : epistemic.healthIndex > 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                  style={{ width: `${epistemic.healthIndex * 100}%` }}
                />
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 border ${isRunning ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : 'bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-600/20'}`}
          >
            <i className={`fas ${isRunning ? 'fa-square' : 'fa-play'}`}></i>
            {isRunning ? 'Halt Core' : 'Ignite Core'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <section className="w-80 border-r border-white/5 flex flex-col glass overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h2 className="font-bold flex items-center gap-2 text-sm">
              <i className="fas fa-layer-group text-indigo-400"></i>
              Active Substrate
            </h2>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md font-mono border border-indigo-500/30">
              {field.getSize()} PKTS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {packets.map((p) => (
              <PacketCard key={p.id} packet={p} />
            ))}
          </div>
        </section>

        <section className="flex-1 flex flex-col bg-slate-900/50 relative">
          <div className="p-4 border-b border-white/5 flex items-center justify-between z-10">
            <div className="flex items-center gap-10">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Innovation Error (εₜ)</span>
                <span className={`text-xl font-mono ${epistemic.innovationError > 0.3 ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {epistemic.innovationError.toFixed(4)}
                </span>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-10">
                <span className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Diversity (Nₑff)</span>
                <span className="text-xl font-mono text-purple-400">
                  {epistemic.diversity.toFixed(2)}
                </span>
              </div>
            </div>
            <button 
              onClick={handleAiAnalysis}
              disabled={isAiLoading}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-white/10 text-indigo-300 hover:bg-indigo-500/10 text-xs font-bold transition-all flex items-center gap-2 shadow-inner"
            >
              {isAiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-brain"></i>}
              Pattern Audit
            </button>
          </div>
          
          <div className="flex-1 relative overflow-hidden">
            <FieldVisualizer packets={packets} latestInnovation={epistemic.innovationError} />
            
            {aiReport && (
              <div className="absolute top-4 right-4 w-80 glass rounded-2xl border border-indigo-500/40 p-5 shadow-2xl animate-in fade-in zoom-in duration-300 z-20 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-2 tracking-widest">
                    <i className="fas fa-sparkles"></i>
                    Epistemic Insight
                  </h3>
                  <button onClick={() => setAiReport("")} className="text-slate-500 hover:text-white transition-colors">
                    <i className="fas fa-times-circle"></i>
                  </button>
                </div>
                <div className="text-xs leading-relaxed text-slate-300 font-medium whitespace-pre-wrap max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {aiReport}
                </div>
              </div>
            )}
          </div>

          <div className="h-44 border-t border-white/5 bg-slate-950/90 p-4 font-mono text-[10px] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3 text-slate-500 uppercase tracking-widest font-black opacity-50">
              <i className="fas fa-terminal"></i> Kernel Output
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3 items-baseline border-l border-white/5 pl-3">
                  <span className="text-indigo-600 font-bold">{i === 0 ? '❯' : ' '}</span>
                  <span className={l.includes('Operator') ? 'text-emerald-500' : l.includes('AI') ? 'text-indigo-400' : 'text-slate-400'}>
                    {l}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-80 border-l border-white/5 glass flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/5">
            <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
              <i className="fas fa-shield-halved text-cyan-400"></i>
              Epistemic Status
            </h2>
          </div>
          <div className="p-5 flex-1 overflow-y-auto space-y-8">
            <div className="space-y-6">
              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Surprise (εₜ)</span>
                  <span className={`text-xs font-mono font-bold ${epistemic.innovationError > 0.4 ? 'text-rose-400' : 'text-cyan-400'}`}>
                    {(epistemic.innovationError).toFixed(3)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full border border-white/5 p-[2px]">
                  <div className={`h-full rounded-full transition-all duration-500 ${epistemic.innovationError > 0.4 ? 'bg-rose-500' : 'bg-cyan-500'}`} style={{ width: `${Math.min(100, epistemic.innovationError * 200)}%` }}></div>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">Prediction surprise. High values indicate the model is failing to track the world state.</p>
              </div>

              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Diversity (Nₑff)</span>
                  <span className={`text-xs font-mono font-bold ${epistemic.diversity < 1.5 ? 'text-amber-400' : 'text-purple-400'}`}>
                    {epistemic.diversity.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full border border-white/5 p-[2px]">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (epistemic.diversity / 5) * 100)}%` }}></div>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">Anti-collapse measure. Low diversity indicates mode collapse into a single concept.</p>
              </div>

              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coherence (Sₜ)</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {(epistemic.coherence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full border border-white/5 p-[2px]">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${epistemic.coherence * 100}%` }}></div>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">Local-to-global consistency. Measures how well partial models agree on overlaps.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 flex flex-col gap-3">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">System Decision Logic</span>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] text-slate-400">Mode Collapse</span>
                  <span className={`text-[9px] font-bold ${epistemic.diversity < 1.5 ? 'text-rose-400' : 'text-slate-600'}`}>
                    {epistemic.diversity < 1.5 ? 'CRITICAL' : 'NOMINAL'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Hallucination Risk</span>
                  <span className={`text-[9px] font-bold ${epistemic.coherence < 0.9 ? 'text-amber-400' : 'text-slate-600'}`}>
                    {epistemic.coherence < 0.9 ? 'ELEVATED' : 'MINIMAL'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <div className="text-[9px] text-slate-500 italic bg-slate-900/30 p-4 rounded-xl border border-white/5 leading-relaxed tracking-wide">
                "Dispersion is success of compression, not truth. We triangulate reality through surprise, diversity, and coherence."
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
