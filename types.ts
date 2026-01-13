
export type PacketID = string;

export interface InfoPacket {
  id: PacketID;
  t: number;
  kind: "observation" | "belief" | "goal" | "model" | "trace" | "summary" | "self_model" | "vireax_anchor" | string;
  payload: any;
  embedding?: [number, number];
  tags: string[];
  confidence: number;
  parents: PacketID[];
  operator?: string;
  meta: Record<string, any>;
}

export interface EpistemicStatus {
  innovationError: number;  // epsilon_t: Surprise
  diversity: number;        // Neff: Effective number of clusters
  coherence: number;        // S_t: Sheaf inconsistency (inverted)
  recursionDominance: number; // R_t: Ratio of internal processing
  volatility: number;       // v_t: Environmental fluctuation
  healthIndex: number;      // H_t: Global Vitality Functional
}

export interface SimSelf {
  identity: string;
  vireax_id?: PacketID;
  vars: {
    arousal: number;
    curiosity: number;
    stability: number;
    phase_offset: number; // For temporal-crystalline simulation
    [key: string]: number;
  };
}

export interface FieldQuery {
  tags_any?: string[];
  tags_all?: string[];
  kinds?: string[];
  since_t?: number;
  until_t?: number;
  limit?: number;
}

export interface OpContext {
  step: number;
  budget: Record<string, number>;
  meta: Record<string, any>;
}

export interface OpResult {
  produced: InfoPacket[];
  consumed: PacketID[];
  score_delta: number;
  notes: string[];
}
