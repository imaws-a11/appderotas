import express from "express";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db.js";

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

  // Delete an address
  app.delete("/api/addresses/:id", (req, res) => {
    const { id } = req.params;
    try {
      // First, delete any route_stops referencing this address to maintain referential integrity
      db.prepare("DELETE FROM route_stops WHERE address_id = ?").run(id);
      // Then delete the address
      const info = db.prepare("DELETE FROM addresses WHERE id = ?").run(id);
      
      if (info.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Address not found" });
      }
    } catch (error) {
      console.error("Failed to delete address:", error);
      res.status(500).json({ error: "Failed to delete address" });
    }
  });

  // Update an address
  app.put("/api/addresses/:id", (req, res) => {
    const { id } = req.params;
    const { latitude, longitude, street, number, neighborhood, city, state, zip_code, label_code } = req.body;
    try {
      const stmt = db.prepare(`
        UPDATE addresses 
        SET latitude = ?, longitude = ?, street = ?, number = ?, neighborhood = ?, city = ?, state = ?, zip_code = ?, label_code = ?
        WHERE id = ?
      `);
      const info = stmt.run(latitude, longitude, street, number, neighborhood, city, state, zip_code, label_code, id);
      
      if (info.changes > 0) {
        const updatedAddress = db.prepare("SELECT * FROM addresses WHERE id = ?").get(id);
        res.json(updatedAddress);
      } else {
        res.status(404).json({ error: "Address not found" });
      }
    } catch (error) {
      console.error("Failed to update address:", error);
      res.status(500).json({ error: "Failed to update address" });
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
