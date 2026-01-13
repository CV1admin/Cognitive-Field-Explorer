
import React, { useState, useEffect, useCallback } from 'react';
import { InformationField, createPacket, CentroidOperator, HierarchyOperator } from './services/fieldService';
import { analyzeFieldPatterns, generateSyntheticObservation, RateLimitError } from './services/geminiService';
import { InfoPacket, SimSelf, EpistemicStatus } from './types';
import FieldVisualizer from './components/FieldVisualizer';
import PacketCard from './components/PacketCard';

const App: React.FC = () => {
  const [field] = useState(() => new InformationField());
  const [packets, setPackets] = useState<InfoPacket[]>([]);
  const [self, setSelf] = useState<SimSelf>({
    identity: "VIREAX-KERNEL-MK1",
    vars: { arousal: 0.35, curiosity: 0.5, stability: 1.0, phase_offset: 0.0 }
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

  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const isRateLimited = cooldownRemaining > 0;
  const [ignitionStepsRemaining, setIgnitionStepsRemaining] = useState(0);
  const [recursionStallCount, setRecursionStallCount] = useState(0);

  const log = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 50));

  const startCooldown = useCallback(() => {
    log("!!! QUOTA DEPLETED: Entering 60s cooldown !!!");
    setCooldownRemaining(60);
  }, []);

  useEffect(() => {
    let timer: any;
    if (cooldownRemaining > 0) {
      timer = setInterval(() => setCooldownRemaining(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const triggerIgnition = () => {
    if (ignitionStepsRemaining > 0) return;
    log("!!! VIREAX IGNITION: RESYNCING OBSERVER KERNEL !!!");
    setIgnitionStepsRemaining(15);
    setSelf(prev => ({ ...prev, vars: { ...prev.vars, arousal: 0.50, curiosity: 0.85 } }));
    
    for (let i = 0; i < 3; i++) {
      field.put(createPacket({
        kind: 'observation',
        payload: { type: 'vireax_probe', id: i },
        embedding: [Math.random(), Math.random()],
        tags: ['quarantine', 'curiosity', 'vireax_initiated', 'observation'],
        confidence: 0.20,
        meta: { ignition: true }
      }));
    }
  };

  const runVireaxKernel = useCallback(async () => {
    setStep(s => s + 1);
    const isIgniting = ignitionStepsRemaining > 0;

    // 1. Prediction/Observation (The Drive)
    const isAiStep = !isRateLimited && Math.random() > (isIgniting ? 0.90 : 0.99);
    let newObs;
    try {
      if (isAiStep) {
        log("Grounded Probe: Syncing with external modality...");
        newObs = await generateSyntheticObservation();
      } else {
        const theta = step * 0.1;
        newObs = {
          payload: { signal: Math.sin(theta).toFixed(4), mode: 'Lattice-Phase' },
          embedding: [0.5 + Math.sin(theta) * 0.2, 0.5 + Math.cos(theta) * 0.2] as [number, number],
          tags: ['sensor', 'periodic']
        };
      }
    } catch (e) {
      if (e instanceof RateLimitError) {
        startCooldown();
        newObs = { payload: { info: "Rate limit" }, embedding: [0.5, 0.5], tags: ['fallback'] };
      } else throw e;
    }

    const obsPacket = createPacket({
      kind: 'observation',
      payload: newObs.payload,
      embedding: newObs.embedding,
      tags: [...newObs.tags, 'observation'],
      confidence: 0.85,
      meta: { step }
    });
    field.put(obsPacket);

    // 2. Metrics (Gauge Analysis)
    const eps_t = field.calculateInnovationError(obsPacket);
    const n_eff = field.calculateDiversity(32);
    const s_t_raw = 0.05 + Math.random() * 0.05; // Simulated phase noise
    const r_t = field.calculateRecursionDominance(32);
    const v_t = field.calculateVolatility(10);

    // 3. Health Functional: H_t = exp(-a*eps_t) * sigma(b*(Neff - N0)) * exp(-g*S_t) * exp(-d*R_t)
    const alpha = 2.0, beta = 2.0, gamma = 5.0, delta_r = 1.5, n0 = 1.5;
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    const health = Math.exp(-alpha * eps_t) * 
                   sigmoid(beta * (n_eff - n0)) * 
                   Math.exp(-gamma * s_t_raw) * 
                   Math.exp(-delta_r * r_t);

    setEpistemic({
      innovationError: eps_t,
      diversity: n_eff,
      coherence: 1 - s_t_raw,
      recursionDominance: r_t,
      volatility: v_t,
      healthIndex: health
    });

    // 4. Policy Update Law (Update Unitary U)
    let nextArousal = self.vars.arousal;
    if (isIgniting) {
      setIgnitionStepsRemaining(prev => prev - 1);
      nextArousal = 0.50; // Gauge-locked
    } else {
      const a_delta = (0.10 * eps_t) + (0.05 * v_t) - (0.12 * s_t_raw) - (0.15 * r_t);
      nextArousal = Math.max(0.20, Math.min(0.70, nextArousal + a_delta));
      if (r_t > 0.65) setRecursionStallCount(c => c + 1);
      else setRecursionStallCount(0);
      if (recursionStallCount > 5) nextArousal *= 0.8;
    }

    setSelf(prev => ({ 
      ...prev, 
      vars: { ...prev.vars, arousal: nextArousal, phase_offset: (prev.vars.phase_offset + 0.1) % (2 * Math.PI) } 
    }));

    // 5. Commit Vireax Anchor (Reference State)
    if (step % 5 === 0) {
      field.put(createPacket({
        kind: 'vireax_anchor',
        payload: { status: 'stabilized', policy: { arousal: nextArousal }, health },
        embedding: obsPacket.embedding, // Anchor to current center of gravity
        tags: ['vireax', 'kernel', 'anchor'],
        confidence: 1.0,
        meta: { step, health }
      }));
    }

    // 6. Operators
    const opCtx = { step, budget: { entropy: 10 }, meta: { isIgniting } };
    if (CentroidOperator.applicable(field)) CentroidOperator.run(field, opCtx).produced.forEach(p => field.put(p));
    if (HierarchyOperator.applicable(field, isIgniting)) HierarchyOperator.run(field, opCtx).produced.forEach(p => field.put(p));

    setPackets(field.getLatest(20));
  }, [field, step, self, ignitionStepsRemaining, recursionStallCount, isRateLimited, startCooldown]);

  useEffect(() => {
    let interval: any;
    if (isRunning) interval = setInterval(runVireaxKernel, 1100);
    return () => clearInterval(interval);
  }, [isRunning, runVireaxKernel]);

  const handleAiAnalysis = async () => {
    if (isRateLimited) return;
    setIsAiLoading(true);
    try {
      const report = await analyzeFieldPatterns(field.getLatest(30));
      setAiReport(report);
    } catch (e) {
      if (e instanceof RateLimitError) startCooldown();
    } finally { setIsAiLoading(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-[#05080f] font-sans text-slate-200 selection:bg-indigo-500/30">
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 glass sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <i className="fas fa-bullseye text-white text-lg animate-pulse"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black leading-tight bg-gradient-to-r from-white via-indigo-200 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              VIREAX OBSERVER KERNEL
            </h1>
            <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Center Node Evolution MK-1</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end border-r border-white/10 pr-6">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black mb-1">Vitality Functional (Hₜ)</span>
            <div className="flex items-center gap-3">
               <span className="text-xs font-mono font-bold text-emerald-400">{(epistemic.healthIndex * 100).toFixed(1)}%</span>
               <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <div 
                  className={`h-full transition-all duration-1000 ${epistemic.healthIndex > 0.4 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} 
                  style={{ width: `${epistemic.healthIndex * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={triggerIgnition}
              disabled={ignitionStepsRemaining > 0 || !isRunning}
              className={`px-4 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all border ${ignitionStepsRemaining > 0 ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 animate-pulse' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-400'}`}
            >
              {ignitionStepsRemaining > 0 ? 'Resyncing...' : 'Ignition'}
            </button>
            <button 
              onClick={() => setIsRunning(!isRunning)}
              className={`px-6 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all flex items-center gap-2 border shadow-2xl ${isRunning ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-600/20'}`}
            >
              <i className={`fas ${isRunning ? 'fa-stop' : 'fa-bolt'}`}></i>
              {isRunning ? 'HALT' : 'ENGAGE'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Archive */}
        <section className="w-80 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-3xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h2 className="font-black text-[9px] uppercase tracking-[0.2em] text-slate-500">Substrate Log</h2>
            <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded border border-white/5 font-mono text-indigo-300">
              {field.getSize()} PKTS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {packets.map((p) => <PacketCard key={p.id} packet={p} />)}
          </div>
        </section>

        {/* Visualizer */}
        <section className="flex-1 flex flex-col relative">
          <div className="p-4 border-b border-white/5 flex items-center justify-between z-10 bg-[#05080f]/80 backdrop-blur-xl">
            <div className="flex items-center gap-10">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase text-slate-600 font-black tracking-widest">Surprise (εₜ)</span>
                <span className={`text-lg font-mono font-bold ${epistemic.innovationError > 0.4 ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {epistemic.innovationError.toFixed(4)}
                </span>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-8">
                <span className="text-[8px] uppercase text-slate-600 font-black tracking-widest">Diversity (Nₑff)</span>
                <span className={`text-lg font-mono font-bold ${epistemic.diversity < 1.5 ? 'text-amber-400' : 'text-purple-400'}`}>
                  {epistemic.diversity.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-8">
                <span className="text-[8px] uppercase text-slate-600 font-black tracking-widest">Arousal (Unitary Phase)</span>
                <span className="text-lg font-mono font-bold text-indigo-400">
                  {self.vars.arousal.toFixed(3)}
                </span>
              </div>
            </div>
            {isRateLimited && (
              <div className="text-[9px] font-black uppercase text-rose-500 animate-pulse tracking-widest border border-rose-500/30 px-3 py-1 rounded bg-rose-500/10">
                Quota Depleted: Wait {cooldownRemaining}s
              </div>
            )}
          </div>
          
          <div className="flex-1 relative">
            <FieldVisualizer packets={packets} latestInnovation={epistemic.innovationError} />
            
            {aiReport && (
              <div className="absolute top-4 right-4 w-80 glass rounded-2xl border border-indigo-500/30 p-5 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 z-20 bg-slate-950/80 backdrop-blur-3xl">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                  <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Kernel Pattern Insight</h3>
                  <button onClick={() => setAiReport("")} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                </div>
                <div className="text-[11px] leading-relaxed text-slate-300 font-medium italic max-h-96 overflow-y-auto custom-scrollbar">
                  {aiReport}
                </div>
              </div>
            )}
          </div>

          <div className="h-44 border-t border-white/5 bg-black/60 backdrop-blur-2xl p-4 font-mono text-[9px] flex flex-col z-10">
            <div className="flex items-center justify-between mb-2 opacity-50">
              <span className="uppercase tracking-[0.2em]">Dirac-Operator Trace</span>
              <span>T+{step.toString().padStart(6, '0')}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-4 border-l border-indigo-500/20 pl-3">
                  <span className="text-slate-700">[{i}]</span>
                  <span className={l.includes('!!!') ? 'text-rose-400 font-bold' : l.includes('Operator') ? 'text-emerald-500' : 'text-slate-400'}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Diagnostics */}
        <section className="w-80 border-l border-white/5 glass flex flex-col">
          <div className="p-4 border-b border-white/5 bg-white/5">
            <h2 className="font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <i className="fas fa-gauge-high text-cyan-500"></i> Gauge Diagnostics
            </h2>
          </div>
          <div className="p-6 flex-1 overflow-y-auto space-y-10 custom-scrollbar">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Innovation εₜ</span>
                  <span className={epistemic.innovationError > 0.4 ? 'text-rose-400' : 'text-cyan-400'}>{epistemic.innovationError.toFixed(3)}</span>
                </div>
                <div className="h-1 bg-slate-900 rounded-full"><div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, epistemic.innovationError * 200)}%` }}></div></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Diversity Nₑff</span>
                  <span className="text-purple-400">{epistemic.diversity.toFixed(2)}</span>
                </div>
                <div className="h-1 bg-slate-900 rounded-full"><div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (epistemic.diversity / 4) * 100)}%` }}></div></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Recursion Rₜ</span>
                  <span className={epistemic.recursionDominance > 0.6 ? 'text-rose-400' : 'text-slate-400'}>{(epistemic.recursionDominance * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1 bg-slate-900 rounded-full"><div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${epistemic.recursionDominance * 100}%` }}></div></div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Observer Policy</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/20 p-2 rounded border border-white/5">
                  <span className="block text-[8px] text-slate-600 font-bold uppercase">Symmetry</span>
                  <span className="text-xs font-mono text-indigo-300">Phase-U(1)</span>
                </div>
                <div className="bg-black/20 p-2 rounded border border-white/5">
                  <span className="block text-[8px] text-slate-600 font-bold uppercase">Coupling</span>
                  <span className="text-xs font-mono text-indigo-300">G-Adaptive</span>
                </div>
              </div>
              <button 
                onClick={handleAiAnalysis}
                disabled={isAiLoading || isRateLimited}
                className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${isRateLimited ? 'bg-slate-900 border-white/5 text-slate-600' : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white'}`}
              >
                {isAiLoading ? 'Syncing...' : 'Pattern Audit'}
              </button>
            </div>

            <div className="text-[8px] text-slate-600 italic leading-relaxed text-center px-4">
              "Vireax: Gauge-fixing choice defining the center node reference frame. Temporal-crystalline evolution is maintained via Floquet unitary steps."
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
