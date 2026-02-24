
const IS_NATIVE = window.location.protocol === 'capacitor:' || window.location.hostname === 'localhost' && !window.location.port;

// Simple Local Storage based database for offline/native use
const localDB = {
  get: (key: string) => JSON.parse(localStorage.getItem(`vpro_${key}`) || '[]'),
  set: (key: string, data: any) => localStorage.setItem(`vpro_${key}`, JSON.stringify(data)),
  
  // Helper to get current session or create one
  getCurrentSession: () => {
    const sessions = localDB.get('sessions');
    let current = sessions.find((s: any) => s.is_closed === 0);
    if (!current) {
      current = { id: Date.now(), start_time: new Date().toISOString(), is_closed: 0, end_time: null };
      localDB.set('sessions', [...sessions, current]);
    }
    return current;
  }
};

export const api = {
  async getProducts() {
    try {
      const res = await fetch('/api/products');
      if (res.ok) return await res.json();
    } catch (e) {}
    return localDB.get('products').filter((p: any) => !p.deleted);
  },

  async addProduct(product: any) {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    
    const products = localDB.get('products');
    const newProduct = { ...product, id: Date.now(), stock: product.initial_stock, deleted: 0 };
    localDB.set('products', [...products, newProduct]);
    return newProduct;
  },

  async updateProduct(id: number, product: any) {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const products = localDB.get('products');
    const index = products.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...product };
      localDB.set('products', products);
    }
    return { success: true };
  },

  async deleteProduct(id: number) {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch (e) {}

    const products = localDB.get('products');
    const index = products.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      products[index].deleted = 1;
      localDB.set('products', products);
    }
    return { success: true };
  },

  async moveInventory(move: any) {
    try {
      const res = await fetch('/api/inventory/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(move)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const products = localDB.get('products');
    const product = products.find((p: any) => p.id === move.product_id);
    if (product) {
      if (move.type === 'entry') product.stock += move.quantity;
      else if (move.type === 'waste') product.stock -= move.quantity;
      localDB.set('products', products);
      
      const session = localDB.getCurrentSession();
      const movements = localDB.get('movements');
      movements.push({ 
        ...move, 
        product_name: product.name,
        id: Date.now(), 
        session_id: session.id, 
        timestamp: new Date().toISOString() 
      });
      localDB.set('movements', movements);
    }
    return { success: true };
  },

  async createSale(sale: any) {
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sale)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const session = localDB.getCurrentSession();
    const products = localDB.get('products');
    
    // Update stocks
    sale.items.forEach((item: any) => {
      const p = products.find((prod: any) => prod.id === item.id);
      if (p) p.stock -= item.quantity;
    });
    localDB.set('products', products);

    // Record sale
    const sales = localDB.get('sales');
    const newSale = { ...sale, id: Date.now(), session_id: session.id, timestamp: new Date().toISOString() };
    sales.push(newSale);
    localDB.set('sales', sales);

    // Record movements
    const movements = localDB.get('movements');
    sale.items.forEach((item: any) => {
      movements.push({
        product_id: item.id,
        product_name: item.name,
        type: 'sale',
        quantity: item.quantity,
        reason: 'Venta',
        session_id: session.id,
        timestamp: new Date().toISOString()
      });
    });
    localDB.set('movements', movements);

    return { success: true, saleId: newSale.id };
  },

  async getCurrentReport() {
    try {
      const res = await fetch('/api/reports/current');
      if (res.ok) return await res.json();
    } catch (e) {}

    const session = localDB.getCurrentSession();
    const sales = localDB.get('sales').filter((s: any) => s.session_id === session.id);
    const movements = localDB.get('movements').filter((m: any) => m.session_id === session.id);
    return { sales, movements, session };
  },

  async getSessionHistory() {
    try {
      const res = await fetch('/api/sessions/history');
      if (res.ok) return await res.json();
    } catch (e) {}
    return localDB.get('sessions').filter((s: any) => s.is_closed === 1).sort((a: any, b: any) => b.id - a.id);
  },

  async closeSession() {
    try {
      const res = await fetch('/api/sessions/close', { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (e) {}

    const sessions = localDB.get('sessions');
    const current = sessions.find((s: any) => s.is_closed === 0);
    if (current) {
      current.is_closed = 1;
      current.end_time = new Date().toISOString();
      const next = { id: Date.now(), start_time: new Date().toISOString(), is_closed: 0, end_time: null };
      sessions.push(next);
      localDB.set('sessions', sessions);
    }
    return { success: true };
  },

  async getSessionReport(id: number) {
    try {
      const res = await fetch(`/api/reports/session/${id}`);
      if (res.ok) return await res.json();
    } catch (e) {}

    const sales = localDB.get('sales').filter((s: any) => s.session_id === id);
    const movements = localDB.get('movements').filter((m: any) => m.session_id === id);
    return { sales, movements };
  }
};
