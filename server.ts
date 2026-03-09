import express from "express";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db.js";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // --- API Routes ---

  // Get all addresses
  app.get("/api/addresses", (req, res) => {
    try {
      const addresses = db.prepare("SELECT * FROM addresses ORDER BY created_at DESC").all();
      res.json(addresses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch addresses" });
    }
  });

  // Create a new address
  app.post("/api/addresses", (req, res) => {
    const { latitude, longitude, street, number, neighborhood, city, state, zip_code, image_url, label_code, is_registered_by_photo } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO addresses (latitude, longitude, street, number, neighborhood, city, state, zip_code, image_url, label_code, is_registered_by_photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(latitude, longitude, street, number, neighborhood, city, state, zip_code, image_url, label_code, is_registered_by_photo ? 1 : 0);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create address" });
    }
  });

  // Analyze address image using Gemini
  app.post("/api/analyze-address", async (req, res) => {
    const { imageBase64, latitude, longitude } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: "Image is required" });
    }

    try {
      // 1. Analyze image to extract text/address details using gemini-3.1-pro-preview
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

      let extractedData = {};
      try {
        extractedData = JSON.parse(analysisResponse.text || "{}");
      } catch (e) {
        console.error("Failed to parse Gemini response", e);
      }

      // 2. Use Maps Grounding to refine the address based on coordinates and extracted text
      let refinedAddress = { ...extractedData };
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
                  latitude: parseFloat(latitude),
                  longitude: parseFloat(longitude)
                }
              }
            }
          }
        });
        
        // We can't enforce JSON schema with googleMaps tool, so we'll ask a fast model to parse it
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
          refinedAddress = { ...refinedAddress, ...parsedMapsData };
        } catch (e) {
          console.error("Failed to parse maps refinement", e);
        }
      }

      res.json(refinedAddress);
    } catch (error) {
      console.error("Error analyzing address:", error);
      res.status(500).json({ error: "Failed to analyze address" });
    }
  });

  // Validate label code (manual entry)
  app.post("/api/validate-label", (req, res) => {
    const { code } = req.body;
    try {
      const address = db.prepare("SELECT * FROM addresses WHERE label_code = ?").get(code);
      if (address) {
        res.json({ valid: true, address });
      } else {
        res.json({ valid: false });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to validate label" });
    }
  });

  // Scan label image using Gemini
  app.post("/api/scan-label", async (req, res) => {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: "Image is required" });
    }

    try {
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

      let extractedData: any = {};
      try {
        extractedData = JSON.parse(analysisResponse.text || "{}");
      } catch (e) {
        console.error("Failed to parse Gemini response", e);
      }

      // Try to find matching address in DB
      let address = null;
      
      if (extractedData.label_code) {
        address = db.prepare("SELECT * FROM addresses WHERE label_code = ?").get(extractedData.label_code);
      }
      
      if (!address && extractedData.street && extractedData.number) {
        // Try fuzzy match on street and number
        address = db.prepare("SELECT * FROM addresses WHERE street LIKE ? AND number = ?").get(`%${extractedData.street}%`, extractedData.number);
      }

      if (address) {
        res.json({ valid: true, address, extractedData });
      } else {
        res.json({ valid: false, extractedData });
      }
    } catch (error) {
      console.error("Error scanning label:", error);
      res.status(500).json({ error: "Failed to scan label" });
    }
  });

  // Get routes
  app.get("/api/routes", (req, res) => {
    try {
      const routes = db.prepare("SELECT * FROM routes ORDER BY created_at DESC").all();
      // Fetch stops for each route
      const routesWithStops = routes.map(route => {
        const stops = db.prepare(`
          SELECT rs.*, a.street, a.number, a.city 
          FROM route_stops rs 
          JOIN addresses a ON rs.address_id = a.id 
          WHERE rs.route_id = ? 
          ORDER BY rs.stop_order ASC
        `).all(route.id);
        return { ...route, stops };
      });
      res.json(routesWithStops);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  // Create route
  app.post("/api/routes", (req, res) => {
    const { name, addressIds } = req.body;
    try {
      db.transaction(() => {
        const routeInfo = db.prepare("INSERT INTO routes (name, status) VALUES (?, 'drafting')").run(name);
        const routeId = routeInfo.lastInsertRowid;
        
        const insertStop = db.prepare("INSERT INTO route_stops (route_id, address_id, stop_order, status) VALUES (?, ?, ?, 'pending')");
        addressIds.forEach((addressId: number, index: number) => {
          insertStop.run(routeId, addressId, index + 1);
        });
      })();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create route" });
    }
  });

  // Update stop status
  app.patch("/api/routes/:routeId/stops/:stopId", (req, res) => {
    const { routeId, stopId } = req.params;
    const { status } = req.body;
    try {
      db.prepare("UPDATE route_stops SET status = ? WHERE id = ? AND route_id = ?").run(status, stopId, routeId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update stop status" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
