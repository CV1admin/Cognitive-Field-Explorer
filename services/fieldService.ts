
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
    
    // Maintain timeline sorted by time
    const index = this.timeline.findIndex(item => item.t > pkt.t);
    if (index === -1) {
      this.timeline.push({ t: pkt.t, id: pkt.id });
    } else {
      this.timeline.splice(index, 0, { t: pkt.t, id: pkt.id });
    }

    // Index tags
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

    // Time slicing and initial candidate set if no tags provided
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
    const embCount = pkts.filter(p => p.embedding).length;
    return embCount >= this.minPoints;
  },

  run(field: InformationField, ctx: OpContext): OpResult {
    const pkts = field.query({ tags_any: ['observation', 'belief', 'trace'], limit: this.window });
    const embPkts = pkts.filter(p => p.embedding);
    
    const xSum = embPkts.reduce((acc, p) => acc + p.embedding![0], 0);
    const ySum = embPkts.reduce((acc, p) => acc + p.embedding![1], 0);
    const centroid: [number, number] = [xSum / embPkts.length, ySum / embPkts.length];

    // Simple dispersion
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
