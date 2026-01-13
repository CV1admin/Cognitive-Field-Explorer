
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
  vars: Record<string, number>;
}

export interface Section {
  ctx: string;
  value: [number, number];
  meta?: Record<string, any>;
}

export interface SheafConsistency {
  ok: boolean;
  max_violation: number;
  violations: [string, string, number][];
}
