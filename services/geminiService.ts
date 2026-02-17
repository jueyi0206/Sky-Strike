
import { GoogleGenAI, Type } from "@google/genai";
import { GameBriefing } from "../types";

// Initialize lazily within the function to handle potential missing env vars more gracefully
export async function getMissionBriefing(level: number): Promise<GameBriefing> {
  const defaults = [
    { title: "Coral Sea", description: "Clear the naval blockade and open the path.", difficulty: "Normal" },
    { title: "Iron Peak", description: "Infiltrate the mountain hangar and destroy the prototype.", difficulty: "Hard" },
    { title: "Final Reckoning", description: "Strike the heart of the enemy empire. No turning back.", difficulty: "Extreme" }
  ];

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a dramatic short mission briefing for Level ${level} of a 1945 style arcade airplane shooter. 
      Level 1: Pacific Islands. Level 2: Mountain Fortress. Level 3: Urban Capital/Final Strike.
      It should be exciting, cinematic, and under 150 characters. Use Traditional Chinese for the content.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            difficulty: { type: Type.STRING }
          },
          required: ["title", "description", "difficulty"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.warn("Failed to fetch briefing from Gemini, using local defaults:", error);
    return defaults[level - 1] || defaults[0];
  }
}