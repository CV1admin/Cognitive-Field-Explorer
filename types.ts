
export type PacketID = string;

export interface InfoPacket {
  id: PacketID;
  t: number;
  kind: "observation" | "belief" | "goal" | "model" | "trace" | "summary" | "self_model" | string;
  payload: any;
  embedding?: [number, number]; // Simplified to 2D for visualization
  tags: string[];
  confidence: number;
  parents: PacketID[];
  operator?: string;
  meta: Record<string, any>;
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

export interface SimSelf {
  identity: string;
  self_packet_id?: PacketID;
  vars: {
    arousal: number;
    curiosity: number;
    stability: number;
    [key: string]: number;
  };
}

export interface EpistemicStatus {
  innovationError: number;  // epsilon_t: Surprise/Prediction error
  diversity: number;        // Neff: Effective number of clusters (anti-collapse)
  coherence: number;        // S_t: Sheaf inconsistency (inverted for 'coherence')
  recursionDominance: number; // R_t: Ratio of internal vs external processing
  volatility: number;       // v_t: Environmental fluctuation speed
  healthIndex: number;      // H_t: Combined metric
}

export interface SheafConsistency {
  ok: boolean;
  max_violation: number;
  violations: [string, string, number][];
}
