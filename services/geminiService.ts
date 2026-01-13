
import { GoogleGenAI, Type } from "@google/genai";
import { InfoPacket } from "../types";

export async function analyzeFieldPatterns(packets: InfoPacket[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze the following cognitive field packets from an AI's internal memory. 
    Summarize the current state, identify emerging patterns, and suggest potential "Higher-Order Cognitive Goals".

    Packets:
    ${JSON.stringify(packets.map(p => ({ kind: p.kind, tags: p.tags, payload: p.payload })), null, 2)}

    Format the response as a professional, brief cognitive report.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Cognitive synchronization failed.";
  }
}

export async function generateSyntheticObservation(): Promise<{ payload: any; embedding: [number, number]; tags: string[] }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: 'Generate a random, interesting data point for a cognitive system (e.g. sensor data, user input, abstract thought). Provide it as JSON with fields "payload" (object), "embedding" (array of 2 floats 0-1), and "tags" (array of strings).',
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          payload: { type: Type.OBJECT, properties: { data: { type: Type.STRING } } },
          embedding: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["payload", "embedding", "tags"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return {
      payload: data.payload || { info: "Random signal detected" },
      embedding: (data.embedding || [Math.random(), Math.random()]).slice(0, 2) as [number, number],
      tags: data.tags || ['synthetic', 'external']
    };
  } catch (e) {
    return {
      payload: { info: "Fallback signal" },
      embedding: [Math.random(), Math.random()],
      tags: ['fallback']
    };
  }
}
