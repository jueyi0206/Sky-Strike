
import { GoogleGenAI, Type } from "@google/genai";

export async function getMissionBriefing(level) {
  const defaults = [
    { title: "珊瑚海行動", description: "突破敵軍海上封鎖，為大部隊開路。", difficulty: "普通" },
    { title: "鐵峰基地", description: "滲透山脈隱藏機庫，摧毀敵軍原型機。", difficulty: "困難" },
    { title: "最終決戰", description: "直搗敵軍總部心臟。這是最後的希望。", difficulty: "極限" }
  ];

  const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
  
  if (!apiKey) return defaults[level - 1] || defaults[0];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a dramatic mission briefing for Level ${level} of a 1945 style shooter. 
      Level 1: Pacific Ocean (Naval battle).
      Level 2: Secret Mountain Base (Aerial infiltration).
      Level 3: Capital City (Final showdown).
      Limit 100 characters. Use Traditional Chinese.`,
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
    return defaults[level - 1] || defaults[0];
  }
}
