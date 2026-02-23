import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("business.db");
db.pragma('journal_mode = WAL');

// Initialize Database Schema
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      is_closed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      initial_stock INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      product_id INTEGER,
      type TEXT CHECK(type IN ('entry', 'waste', 'sale')),
      quantity INTEGER,
      reason TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      total REAL,
      payment_method TEXT CHECK(payment_method IN ('cash', 'transfer')),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      price_at_sale REAL,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
} catch (error) {
  console.error("Database schema initialization error:", error);
}

// Migrations for existing databases
try { db.exec("ALTER TABLE movements ADD COLUMN session_id INTEGER;"); } catch (e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN session_id INTEGER;"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN deleted INTEGER DEFAULT 0;"); } catch (e) {}

// Robust check for image column
const tableInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
if (!tableInfo.some(col => col.name === 'image')) {
  console.log("Adding image column to products table...");
  db.exec("ALTER TABLE products ADD COLUMN image TEXT;");
}

// Helper to get or create current session
function getCurrentSession() {
  try {
    let session = db.prepare("SELECT * FROM sessions WHERE is_closed = 0 ORDER BY id DESC LIMIT 1").get();
    if (!session) {
      const info = db.prepare("INSERT INTO sessions (is_closed) VALUES (0)").run();
      session = { id: info.lastInsertRowid, is_closed: 0, start_time: new Date().toISOString() };
    }
    return session;
  } catch (error) {
    console.error("Error getting current session:", error);
    throw error;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
  
  app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      const size = req.body ? JSON.stringify(req.body).length : 0;
      console.log(`${req.method} ${req.url} - Payload size: ${(size / 1024).toFixed(2)} KB`);
    }
    next();
  });
  const PORT = 3000;

  // API Routes
  
  // Sessions
  app.get("/api/sessions/current", (req, res) => {
    try {
      res.json(getCurrentSession());
    } catch (e) {
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.get("/api/sessions/history", (req, res) => {
    try {
      const sessions = db.prepare("SELECT * FROM sessions WHERE is_closed = 1 ORDER BY end_time DESC").all();
      res.json(sessions);
    } catch (e) {
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  app.post("/api/sessions/close", (req, res) => {
    try {
      console.log("Closing current session...");
      const transaction = db.transaction(() => {
        const session = getCurrentSession();
        db.prepare("UPDATE sessions SET is_closed = 1, end_time = CURRENT_TIMESTAMP WHERE id = ?").run(session.id);
        const info = db.prepare("INSERT INTO sessions (is_closed) VALUES (0)").run();
        return { closed_id: session.id, new_id: info.lastInsertRowid };
      });
      const result = transaction();
      console.log(`Session ${result.closed_id} closed. New session: ${result.new_id}`);
      res.json({ success: true, ...result });
    } catch (e) {
      console.error("Close session error:", e);
      res.status(500).json({ error: "Failed to close session" });
    }
  });

  // Products
  app.get("/api/products", (req, res) => {
    try {
      const products = db.prepare("SELECT * FROM products WHERE deleted = 0").all();
      res.json(products);
    } catch (e) {
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.post("/api/products", (req, res) => {
    try {
      const { name, price, initial_stock } = req.body;
      console.log(`Creating product: ${name}, price: ${price}, stock: ${initial_stock}`);
      const info = db.prepare("INSERT INTO products (name, price, stock, initial_stock) VALUES (?, ?, ?, ?)")
        .run(name, price, initial_stock, initial_stock);
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      console.error("Create product error:", e);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }
      const { name, price, stock } = req.body;
      console.log(`Updating product ID ${id}: ${name}, price: ${price}, stock: ${stock}`);
      
      const result = db.prepare("UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?")
        .run(name, price, stock, id);
      
      console.log(`Update result: ${JSON.stringify(result)}`);
      res.json({ success: true, changes: result.changes });
    } catch (e) {
      console.error("Update product error:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }
      console.log(`Soft deleting product ID: ${id}`);
      
      const result = db.prepare("UPDATE products SET deleted = 1 WHERE id = ?").run(id);
      console.log(`Soft delete result: ${JSON.stringify(result)}`);
      
      res.json({ success: true, changes: result.changes });
    } catch (e) {
      console.error("Delete product error:", e);
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to delete product" });
    }
  });

  // Inventory Movements
  app.post("/api/inventory/move", (req, res) => {
    try {
      const { product_id, type, quantity, reason } = req.body;
      console.log(`Inventory move request: ${type} ${quantity} for product ${product_id}`);
      const session = getCurrentSession();
      
      const product = db.prepare("SELECT stock FROM products WHERE id = ?").get(product_id);
      if (!product) {
        console.error(`Product ${product_id} not found`);
        return res.status(404).json({ error: "Product not found" });
      }

      let newStock = product.stock;
      if (type === 'entry') newStock += quantity;
      else if (type === 'waste') {
        if (product.stock < quantity) {
          console.error(`Insufficient stock for waste: ${product.stock} < ${quantity}`);
          return res.status(400).json({ error: "Insufficient stock for waste" });
        }
        newStock -= quantity;
      }

      const transaction = db.transaction(() => {
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, product_id);
        db.prepare("INSERT INTO movements (session_id, product_id, type, quantity, reason) VALUES (?, ?, ?, ?, ?)")
          .run(session.id, product_id, type, quantity, reason);
      });
      transaction();

      console.log(`Inventory move successful. New stock: ${newStock}`);
      res.json({ success: true, newStock });
    } catch (e) {
      console.error("Move error:", e);
      res.status(500).json({ error: "Failed to record movement" });
    }
  });

  // Sales
  app.post("/api/sales", (req, res) => {
    try {
      const { items, payment_method, total } = req.body;
      console.log(`Sale request: total ${total} via ${payment_method}`);
      const session = getCurrentSession();

      const transaction = db.transaction(() => {
        const saleInfo = db.prepare("INSERT INTO sales (session_id, total, payment_method) VALUES (?, ?, ?)")
          .run(session.id, total, payment_method);
        const saleId = saleInfo.lastInsertRowid;

        for (const item of items) {
          const product = db.prepare("SELECT stock FROM products WHERE id = ?").get(item.id);
          if (product.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}`);
          }

          db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)")
            .run(saleId, item.id, item.quantity, item.price);
          
          db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, item.id);
          
          db.prepare("INSERT INTO movements (session_id, product_id, type, quantity, reason) VALUES (?, ?, 'sale', ?, 'Venta')")
            .run(session.id, item.id, item.quantity);
        }
        return saleId;
      });

      const saleId = transaction();
      console.log(`Sale successful. ID: ${saleId}`);
      res.json({ success: true, saleId });
    } catch (e) {
      console.error("Sale error:", e);
      res.status(400).json({ error: e instanceof Error ? e.message : "Failed to process sale" });
    }
  });

  // Reports
  app.get("/api/reports/session/:id", (req, res) => {
    const sessionId = req.params.id;
    const sales = db.prepare("SELECT * FROM sales WHERE session_id = ?").all(sessionId);
    const movements = db.prepare(`
      SELECT m.*, p.name as product_name 
      FROM movements m 
      JOIN products p ON m.product_id = p.id 
      WHERE m.session_id = ?
    `).all(sessionId);
    
    res.json({ sales, movements });
  });

  app.get("/api/reports/current", (req, res) => {
    const session = getCurrentSession();
    const sales = db.prepare("SELECT * FROM sales WHERE session_id = ?").all(session.id);
    const movements = db.prepare(`
      SELECT m.*, p.name as product_name 
      FROM movements m 
      JOIN products p ON m.product_id = p.id 
      WHERE m.session_id = ?
    `).all(session.id);
    
    res.json({ sales, movements, session });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Database path:", path.resolve("business.db"));
    const count = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;
    console.log(`Database connected. Product count: ${count.count}`);
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  });
}

startServer();
