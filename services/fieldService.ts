
import { v4 as uuidv4 } from 'uuid';
import { InfoPacket, PacketID, FieldQuery, OpContext, OpResult } from '../types';

export class InformationField {
  private packets: Map<PacketID, InfoPacket> = new Map();
  private timeline: { t: number; id: PacketID }[] = [];
  private tagIndex: Map<string, Set<PacketID>> = new Map();

  constructor() {}

  put(pkt: InfoPacket): PacketID {
    if (this.packets.has(pkt.id)) return pkt.id;
    this.packets.set(pkt.id, pkt);
    
    const index = this.timeline.findIndex(item => item.t > pkt.t);
    if (index === -1) {
      this.timeline.push({ t: pkt.t, id: pkt.id });
    } else {
      this.timeline.splice(index, 0, { t: pkt.t, id: pkt.id });
    }

    pkt.tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(pkt.id);
    });

    return pkt.id;
  }

  get(id: PacketID): InfoPacket | undefined {
    return this.packets.get(id);
  }

  query(q: FieldQuery): InfoPacket[] {
    let ids: Set<PacketID> | null = null;

    if (q.tags_any && q.tags_any.length > 0) {
      const anySet = new Set<PacketID>();
      q.tags_any.forEach(tag => {
        const tagIds = this.tagIndex.get(tag);
        if (tagIds) tagIds.forEach(id => anySet.add(id));
      });
      ids = anySet;
    }

    if (q.tags_all && q.tags_all.length > 0) {
      q.tags_all.forEach(tag => {
        const tagIds = this.tagIndex.get(tag) || new Set<PacketID>();
        if (ids === null) {
          ids = new Set(tagIds);
        } else {
          ids = new Set([...ids].filter(x => tagIds.has(x)));
        }
      });
    }

    if (q.since_t !== undefined || q.until_t !== undefined || ids === null) {
      let filteredTimeline = this.timeline;
      if (q.since_t !== undefined) filteredTimeline = filteredTimeline.filter(i => i.t >= q.since_t!);
      if (q.until_t !== undefined) filteredTimeline = filteredTimeline.filter(i => i.t <= q.until_t!);
      
      const timeIds = new Set(filteredTimeline.map(i => i.id));
      if (ids === null) {
        ids = timeIds;
      } else {
        ids = new Set([...ids].filter(x => timeIds.has(x)));
      }
    }

    let results = Array.from(ids).map(id => this.packets.get(id)!).filter(Boolean);

    if (q.kinds && q.kinds.length > 0) {
      const kindSet = new Set(q.kinds);
      results = results.filter(p => kindSet.has(p.kind));
    }

    results.sort((a, b) => b.t - a.t);

    if (q.limit !== undefined) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  getLatest(n: number = 10): InfoPacket[] {
    return this.timeline.slice(-n).reverse().map(item => this.packets.get(item.id)!);
  }

  getSize(): number {
    return this.packets.size;
  }

  // --- Epistemic Logic ---

  calculateInnovationError(latestObs: InfoPacket): number {
    const latestSummary = this.query({ kinds: ['summary'], limit: 1 })[0];
    if (!latestSummary || !latestSummary.embedding || !latestObs.embedding) return 0;
    
    const dx = latestObs.embedding[0] - latestSummary.embedding[0];
    const dy = latestObs.embedding[1] - latestSummary.embedding[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  calculateDiversity(window: number = 32): number {
    const observations = this.query({ kinds: ['observation'], limit: window }).filter(p => p.embedding);
    const summaries = this.query({ kinds: ['summary'], limit: 10 }).filter(p => p.embedding);
    
    if (observations.length === 0 || summaries.length === 0) return 1.0;

    const counts = new Map<PacketID, number>();
    observations.forEach(obs => {
      let nearestId = summaries[0].id;
      let minDist = Infinity;
      summaries.forEach(sum => {
        const d = Math.sqrt(
          Math.pow(obs.embedding![0] - sum.embedding![0], 2) + 
          Math.pow(obs.embedding![1] - sum.embedding![1], 2)
        );
        if (d < minDist) {
          minDist = d;
          nearestId = sum.id;
        }
      });
      counts.set(nearestId, (counts.get(nearestId) || 0) + 1);
    });

    let entropy = 0;
    const total = observations.length;
    counts.forEach(count => {
      const p = count / total;
      entropy -= p * Math.log(p);
    });

    return Math.exp(entropy);
  }

  calculateRecursionDominance(window: number = 32): number {
    const recent = this.getLatest(window);
    if (recent.length === 0) return 0;
    
    const internalKinds = new Set(['summary', 'trace', 'self_model', 'model', 'belief']);
    const internalCount = recent.filter(p => internalKinds.has(p.kind)).length;
    
    return internalCount / recent.length;
  }

  calculateVolatility(window: number = 10): number {
    const obs = this.query({ kinds: ['observation'], limit: window }).filter(p => p.embedding);
    if (obs.length < 2) return 0;
    
    let totalDist = 0;
    for (let i = 0; i < obs.length - 1; i++) {
      const p1 = obs[i].embedding!;
      const p2 = obs[i+1].embedding!;
      totalDist += Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    }
    
    return totalDist / (obs.length - 1);
  }
}

export function createPacket(overrides: Partial<InfoPacket>): InfoPacket {
  return {
    id: uuidv4().replace(/-/g, ''),
    t: Date.now() / 1000,
    kind: 'fact',
    payload: null,
    tags: [],
    confidence: 1.0,
    parents: [],
    meta: {},
    ...overrides
  };
}

export const CentroidOperator = {
  name: 'centroid.compress',
  window: 32,
  minPoints: 4,

  applicable(field: InformationField): boolean {
    const pkts = field.query({ tags_any: ['observation', 'belief', 'trace'], limit: this.window });
    // IMPORTANT: Exclude quarantined probes from normal compression
    const groundedPkts = pkts.filter(p => p.embedding && !p.tags.includes('quarantine'));
    return groundedPkts.length >= this.minPoints;
  },

  run(field: InformationField, ctx: OpContext): OpResult {
    const pkts = field.query({ tags_any: ['observation', 'belief', 'trace'], limit: this.window });
    const embPkts = pkts.filter(p => p.embedding && !p.tags.includes('quarantine'));
    
    const xSum = embPkts.reduce((acc, p) => acc + p.embedding![0], 0);
    const ySum = embPkts.reduce((acc, p) => acc + p.embedding![1], 0);
    const centroid: [number, number] = [xSum / embPkts.length, ySum / embPkts.length];

    const dispersion = embPkts.reduce((acc, p) => {
      const dx = p.embedding![0] - centroid[0];
      const dy = p.embedding![1] - centroid[1];
      return acc + (dx * dx + dy * dy);
    }, 0) / embPkts.length;

    const avgConf = embPkts.reduce((acc, p) => acc + p.confidence, 0) / embPkts.length;
    const finalConf = Math.max(0.1, avgConf * Math.exp(-dispersion));

    const pkt = createPacket({
      kind: 'summary',
      payload: { type: 'centroid_summary', count: embPkts.length, dispersion },
      embedding: centroid,
      tags: ['memory', 'summary'],
      confidence: finalConf,
      parents: embPkts.map(p => p.id),
      operator: this.name,
      meta: { step: ctx.step }
    });

    return {
      produced: [pkt],
      consumed: embPkts.map(p => p.id),
      score_delta: 0.5,
      notes: [`Compressed ${embPkts.length} embeddings into centroid.`]
    };
  }
};

export const HierarchyOperator = {
  name: 'hierarchy.compress',
  window: 96,
  targetCount: 10,

  applicable(field: InformationField, isIgnition: boolean): boolean {
    if (!isIgnition) return false;
    const summaries = field.query({ kinds: ['summary'], limit: this.window });
    return summaries.length >= 10;
  },

  run(field: InformationField, ctx: OpContext): OpResult {
    const summaries = field.query({ kinds: ['summary'], limit: this.window }).filter(p => p.embedding);
    
    // Crude re-clustering into macro-centroids
    const produced: InfoPacket[] = [];
    const stepSize = Math.max(1, Math.floor(summaries.length / this.targetCount));
    
    for (let i = 0; i < summaries.length; i += stepSize) {
      const chunk = summaries.slice(i, i + stepSize);
      if (chunk.length === 0) continue;
      
      const xSum = chunk.reduce((acc, p) => acc + p.embedding![0], 0);
      const ySum = chunk.reduce((acc, p) => acc + p.embedding![1], 0);
      const centroid: [number, number] = [xSum / chunk.length, ySum / chunk.length];
      
      const pkt = createPacket({
        kind: 'summary',
        payload: { type: 'macro_summary', count: chunk.length },
        embedding: centroid,
        tags: ['macro', 'map', 'do_not_prune_micro', 'summary'],
        confidence: 0.7,
        parents: chunk.map(p => p.id),
        operator: this.name,
        meta: { step: ctx.step }
      });
      produced.push(pkt);
    }

    return {
      produced,
      consumed: summaries.map(p => p.id),
      score_delta: 1.0,
      notes: [`Hierarchical re-clustering: Generated ${produced.length} macro-centroids from ${summaries.length} summaries.`]
    };
  }
};
