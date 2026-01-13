
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InformationField, createPacket, CentroidOperator } from './services/fieldService';
import { analyzeFieldPatterns, generateSyntheticObservation } from './services/geminiService';
import { InfoPacket, SimSelf, SheafConsistency } from './types';
import FieldVisualizer from './components/FieldVisualizer';
import PacketCard from './components/PacketCard';

const App: React.FC = () => {
  const [field] = useState(() => new InformationField());
  const [packets, setPackets] = useState<InfoPacket[]>([]);
  const [self, setSelf] = useState<SimSelf>({
    identity: "Observer-1",
    vars: { arousal: 0.2, curiosity: 0.5, stability: 1.0 }
  });
  const [score, setScore] = useState(0);
  const [step, setStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [aiReport, setAiReport] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [sheafStatus, setSheafStatus] = useState<SheafConsistency>({ ok: true, max_violation: 0, violations: [] });

  const log = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 50));
  };

  const runStep = useCallback(async () => {
    setStep(s => s + 1);

    // 1. Observe: Generate a new packet (either random or AI-driven)
    const isAiStep = Math.random() > 0.8;
    let newObs;
    if (isAiStep) {
      log("Initiating AI-driven observation...");
      newObs = await generateSyntheticObservation();
    } else {
      newObs = {
        payload: { signal: Math.random().toFixed(4), type: 'sensor_data' },
        embedding: [Math.random(), Math.random()] as [number, number],
        tags: ['sensor', 'raw']
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

    // 2. Operators: Check and run
    if (CentroidOperator.applicable(field)) {
      const res = CentroidOperator.run(field, { step, budget: { entropy: 10 }, meta: {} });
      res.produced.forEach(p => field.put(p));
      setScore(prev => prev + res.score_delta);
      res.notes.forEach(n => log(`Operator: ${n}`));
    }

    // 3. Self-Update
    if (step % 5 === 0) {
      const selfPacket = createPacket({
        kind: 'self_model',
        payload: { ...self, note: "Self-state update" },
        tags: ['self', 'model'],
        confidence: 0.99,
        meta: { step }
      });
      field.put(selfPacket);
    }

    // 4. Sheaf Consistency Check (Simulated)
    const violation = Math.random() * 0.05;
    setSheafStatus({
      ok: violation < 0.03,
      max_violation: violation,
      violations: violation > 0.03 ? [['PhysicalView', 'LogicView', violation]] : []
    });

    setPackets(field.getLatest(20));
  }, [field, step, self]);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(runStep, 2000);
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
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <i className="fas fa-brain text-white"></i>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Cognitive Field Explorer
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">System Stability</span>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${sheafStatus.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                style={{ width: `${(1 - sheafStatus.max_violation) * 100}%` }}
              />
            </div>
          </div>
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${isRunning ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'}`}
          >
            <i className={`fas ${isRunning ? 'fa-pause' : 'fa-play'}`}></i>
            {isRunning ? 'Pause Core' : 'Start Core'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Substrate View */}
        <section className="w-80 border-r border-white/5 flex flex-col glass overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2">
              <i className="fas fa-database text-indigo-400"></i>
              Substrate
            </h2>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
              {field.getSize()} pkts
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {packets.map((p) => (
              <PacketCard key={p.id} packet={p} />
            ))}
            {packets.length === 0 && (
              <div className="text-center py-20 opacity-30 italic">Substrate empty. Start core to populate.</div>
            )}
          </div>
        </section>

        {/* Center: Visualization Field */}
        <section className="flex-1 flex flex-col bg-slate-900/50">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-tighter">Entropy Score</span>
                <span className="text-xl font-mono text-cyan-400">{score.toFixed(2)}</span>
              </div>
              <div className="flex flex-col border-l border-white/10 pl-6">
                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-tighter">Recursive Steps</span>
                <span className="text-xl font-mono text-indigo-400">{step}</span>
              </div>
            </div>
            <button 
              onClick={handleAiAnalysis}
              disabled={isAiLoading}
              className="px-3 py-1.5 rounded-md border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 text-sm font-medium transition-all flex items-center gap-2"
            >
              {isAiLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
              Gemini Pattern Analysis
            </button>
          </div>
          
          <div className="flex-1 relative">
            <FieldVisualizer packets={packets} />
            
            {/* AI Report Overlay */}
            {aiReport && (
              <div className="absolute top-4 right-4 w-72 glass rounded-xl border border-indigo-500/30 p-4 shadow-2xl animate-in slide-in-from-right fade-in duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-2">
                    <i className="fas fa-robot"></i>
                    Cognitive Report
                  </h3>
                  <button onClick={() => setAiReport("")} className="text-slate-500 hover:text-white">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="text-xs leading-relaxed text-slate-300 font-light italic">
                  {aiReport}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Console */}
          <div className="h-40 border-t border-white/5 bg-slate-950/80 p-3 font-mono text-[11px] overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-2 text-slate-500 uppercase tracking-widest text-[10px] font-bold">
              <i className="fas fa-terminal"></i> Controller Log
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 opacity-80">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-indigo-500">[{new Date().toLocaleTimeString()}]</span>
                  <span className={l.includes('Operator') ? 'text-emerald-400' : 'text-slate-300'}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Sidebar: Agent & Sheaf */}
        <section className="w-72 border-l border-white/5 glass flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h2 className="font-bold flex items-center gap-2">
              <i className="fas fa-id-badge text-cyan-400"></i>
              SimSelf State
            </h2>
          </div>
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-tighter">Arousal</span>
                <span className="text-xs font-mono text-cyan-400">{self.vars.arousal.toFixed(2)}</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full">
                <div className="h-full bg-cyan-400" style={{ width: `${self.vars.arousal * 100}%` }}></div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400 uppercase tracking-tighter">Curiosity</span>
                <span className="text-xs font-mono text-indigo-400">{self.vars.curiosity.toFixed(2)}</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full">
                <div className="h-full bg-indigo-400" style={{ width: `${self.vars.curiosity * 100}%` }}></div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Sheaf Consistency</h3>
              <div className={`p-3 rounded-lg border flex flex-col gap-2 ${sheafStatus.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Status</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${sheafStatus.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {sheafStatus.ok ? 'Coherent' : 'Divergent'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">L2 Max Viol.</span>
                  <span className="text-xs font-mono">{sheafStatus.max_violation.toFixed(4)}</span>
                </div>
                {!sheafStatus.ok && (
                  <div className="text-[10px] text-rose-300 mt-2 bg-rose-950/50 p-1.5 rounded">
                    Violation in overlap U ∩ V: Restriction map mismatch detected.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6">
              <div className="text-[10px] text-slate-500 italic bg-slate-900/50 p-3 rounded-lg border border-white/5 leading-relaxed">
                "Multiple local models are reconciled into a consistent global story via the Sheaf Layer. Omniscience is a bug; local consistency is the feature."
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
