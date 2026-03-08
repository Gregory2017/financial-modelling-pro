import { GoogleGenAI, Type } from "@google/genai";

export const getGeminiAI = () => {
  return new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
};

export const fetchLiveMarketData = async (ticker: string) => {
  try {
    const ai = getGeminiAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for the real-time market data for ${ticker}. 
      Provide the current price, the 24h percentage change, the currency, and a brief 1-sentence market sentiment.
      Current time is ${new Date().toISOString()}.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER },
            changePercent: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            sentiment: { type: Type.STRING },
            lastUpdated: { type: Type.STRING }
          },
          required: ["price", "changePercent", "currency"]
        }
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Market Data Error:", error);
    return null;
  }
};

export const fetchMacroReport = async (): Promise<string | null> => {
  try {
    const ai = getGeminiAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Provide a high-quality macroeconomic report (3-4 paragraphs) about the current state of the global markets, including stocks, crypto, gold, and oil. Focus on correlations, interest rate impacts, and recent trends. Use Markdown with clear headings and bullet points where appropriate.",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || null;
  } catch (error) {
    console.error("Gemini Macro Report failed:", error);
    return null;
  }
};
