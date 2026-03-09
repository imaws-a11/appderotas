import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'routemaster.db');
export const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    latitude REAL,
    longitude REAL,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    image_url TEXT,
    label_code TEXT UNIQUE,
    is_registered_by_photo INTEGER DEFAULT 0,
    is_validated_by_label INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    description TEXT,
    status TEXT DEFAULT 'drafting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS route_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER,
    address_id INTEGER,
    stop_order INTEGER,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id),
    FOREIGN KEY (address_id) REFERENCES addresses(id)
  );
`);

// Insert some dummy data if empty
const addressCount = db.prepare("SELECT COUNT(*) as count FROM addresses").get() as { count: number };
if (addressCount.count === 0) {
  const insertAddress = db.prepare(`
    INSERT INTO addresses (latitude, longitude, street, number, city, label_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertAddress.run(-23.5505, -46.6333, "Av. Paulista", "1000", "São Paulo", "LBL-001");
  insertAddress.run(-23.5515, -46.6343, "Rua Augusta", "500", "São Paulo", "LBL-002");
}
