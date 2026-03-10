import { GoogleGenAI, Type } from "@google/genai";

// Helper to get Gemini instance
const getAI = () => {
  return new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY });
};

export const analyzeAddressImage = async (imageBase64: string, latitude?: number, longitude?: number) => {
  const ai = getAI();
  
  // 1. Analyze image to extract text/address details
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: imageBase64.split(',')[1] || imageBase64,
    },
  };

  const prompt = "Analyze this image of a building or address sign. Extract the street name, building number, and any other address details visible. Return a JSON object with keys: street, number, neighborhood, city, state, zip_code. If a field is not visible, leave it empty.";

  const analysisResponse = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          street: { type: Type.STRING },
          number: { type: Type.STRING },
          neighborhood: { type: Type.STRING },
          city: { type: Type.STRING },
          state: { type: Type.STRING },
          zip_code: { type: Type.STRING },
        }
      }
    }
  });

  let extractedData = JSON.parse(analysisResponse.text || "{}");

  // 2. Use Maps Grounding to refine the address if coordinates are available
  if (latitude && longitude) {
    const mapsPrompt = `Given the following extracted address details: ${JSON.stringify(extractedData)}, and the current GPS coordinates: ${latitude}, ${longitude}. Provide the most accurate and complete formatted address for this location. Return a JSON object with keys: street, number, neighborhood, city, state, zip_code, formatted_address.`;
    
    const mapsResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: mapsPrompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: latitude,
              longitude: longitude
            }
          }
        }
      }
    });
    
    const parsePrompt = `Extract the address components from this text into JSON: ${mapsResponse.text}`;
    const parseResponse = await ai.models.generateContent({
       model: "gemini-3.1-flash-lite-preview",
       contents: parsePrompt,
       config: {
         responseMimeType: "application/json",
         responseSchema: {
           type: Type.OBJECT,
           properties: {
             street: { type: Type.STRING },
             number: { type: Type.STRING },
             neighborhood: { type: Type.STRING },
             city: { type: Type.STRING },
             state: { type: Type.STRING },
             zip_code: { type: Type.STRING },
             formatted_address: { type: Type.STRING }
           }
         }
       }
    });
    
    try {
      const parsedMapsData = JSON.parse(parseResponse.text || "{}");
      extractedData = { ...extractedData, ...parsedMapsData };
    } catch (e) {
      console.error("Failed to parse maps refinement", e);
    }
  }

  return extractedData;
};

export const verifyCoordinates = async (address: any, latitude: number, longitude: number) => {
  const ai = getAI();
  
  const mapsPrompt = `Given the address details: ${JSON.stringify(address)} and the current GPS coordinates: ${latitude}, ${longitude}. Verify if these coordinates are accurate for this address. Return a JSON object with keys: latitude, longitude. If the GPS coordinates seem correct for the address, return them. If they seem off, return the corrected coordinates based on the address using Google Maps.`;
  
  const mapsResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: mapsPrompt,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: latitude,
            longitude: longitude
          }
        }
      }
    }
  });
  
  const parsePrompt = `Extract the latitude and longitude from this text into JSON: ${mapsResponse.text}`;
  const parseResponse = await ai.models.generateContent({
     model: "gemini-3.1-flash-lite-preview",
     contents: parsePrompt,
     config: {
       responseMimeType: "application/json",
       responseSchema: {
         type: Type.OBJECT,
         properties: {
           latitude: { type: Type.NUMBER },
           longitude: { type: Type.NUMBER }
         }
       }
     }
  });
  
  return JSON.parse(parseResponse.text || "{}");
};

export const scanLabelImage = async (imageBase64: string) => {
  const ai = getAI();
  
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: imageBase64.split(',')[1] || imageBase64,
    },
  };

  const prompt = "Analyze this image of a delivery label or package. Extract the tracking code, label code, or the delivery address (street, number, city, zip code). Return a JSON object with keys: label_code, street, number, city, zip_code. If a field is not visible, leave it empty.";

  const analysisResponse = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          label_code: { type: Type.STRING },
          street: { type: Type.STRING },
          number: { type: Type.STRING },
          city: { type: Type.STRING },
          zip_code: { type: Type.STRING },
        }
      }
    }
  });

  return JSON.parse(analysisResponse.text || "{}");
};

export const optimizeRoute = async (addresses: any[], startLocation: {lat: number, lng: number} | null) => {
  const ai = getAI();
  
  const prompt = `
    You are a route optimization expert. Given a starting location and a list of delivery addresses with their coordinates, determine the most efficient sequence (shortest path) to visit all addresses.
    
    Starting Location: ${startLocation ? JSON.stringify(startLocation) : "Not provided (use the first address as start)"}
    Addresses to visit: ${JSON.stringify(addresses.map((a: any) => ({ id: a.id, lat: a.latitude, lng: a.longitude, street: a.street })))}
    
    Return ONLY a JSON object with a single key "optimizedOrder" which is an array of the address IDs in the best sequence.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          optimizedOrder: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          }
        },
        required: ["optimizedOrder"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
