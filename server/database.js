const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(process.env.DB_PATH || path.join(dataDir, 'delivery.db'));

// Execute pragmas and schema
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    role TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    phone TEXT,
    photo_url TEXT,
    card_number TEXT,
    card_holder TEXT,
    point_name TEXT,
    address TEXT,
    lat REAL,
    lon REAL,
    seller_balance REAL DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    total_earned REAL DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    unpaid_amount REAL DEFAULT 0,
    admin_share REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    weight TEXT,
    photo_url TEXT,
    is_available INTEGER DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    seller_id INTEGER,
    courier_id INTEGER,
    product_id INTEGER,
    items_json TEXT,
    quantity INTEGER DEFAULT 1,
    total_price REAL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT DEFAULT 'card',
    receipt_url TEXT,
    delivery_address TEXT,
    customer_lat REAL,
    customer_lon REAL,
    seller_lat REAL,
    seller_lon REAL,
    courier_lat REAL,
    courier_lon REAL,
    shares_deducted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (courier_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    order_id INTEGER,
    amount REAL,
    receipt_url TEXT,
    status TEXT DEFAULT 'pending',
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    to_user_id INTEGER,
    gift_emoji TEXT,
    gift_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    text TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS seller_profiles (
    user_id INTEGER PRIMARY KEY,
    shop_name TEXT,
    active_balance REAL DEFAULT 0,
    frozen_balance REAL DEFAULT 0,
    is_open INTEGER DEFAULT 1,
    shop_lat REAL,
    shop_lng REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS courier_profiles (
    user_id INTEGER PRIMARY KEY,
    total_earnings REAL DEFAULT 0,
    unpaid_earnings REAL DEFAULT 0,
    completed_orders_count INTEGER DEFAULT 0,
    current_lat REAL,
    current_lng REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    order_id INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    receipt_image_url TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS feedbacks_and_gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    text_or_gift_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS access_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    requested_role TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    phone TEXT,
    shop_name TEXT,
    vehicle_type TEXT,
    status TEXT DEFAULT 'pending',
    access_code TEXT,
    admin_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
  );
`);

// Safe migrations for existing database tables
function addColumnIfNotExists(table, column, definition) {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!info.some(col => col.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`➕ Added column ${table}.${column}`);
    }
  } catch (e) {
    console.error(`Migration warning for ${table}.${column}:`, e.message);
  }
}

addColumnIfNotExists('users', 'address', 'TEXT');
addColumnIfNotExists('users', 'lat', 'REAL');
addColumnIfNotExists('users', 'lon', 'REAL');
addColumnIfNotExists('users', 'seller_balance', 'REAL DEFAULT 0');
addColumnIfNotExists('users', 'frozen_balance', 'REAL DEFAULT 0');
addColumnIfNotExists('users', 'required_deposit_amount', 'REAL DEFAULT 300000');
addColumnIfNotExists('users', 'is_open', 'INTEGER DEFAULT 1');
addColumnIfNotExists('users', 'is_online', 'INTEGER DEFAULT 1');
addColumnIfNotExists('users', 'is_seller_approved', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'is_courier_approved', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'seller_access_code', 'TEXT');
addColumnIfNotExists('users', 'courier_access_code', 'TEXT');
addColumnIfNotExists('users', 'terms_accepted', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'terms_accepted_at', 'DATETIME');

addColumnIfNotExists('orders', 'items_json', 'TEXT');
addColumnIfNotExists('orders', 'payment_method', "TEXT DEFAULT 'card'");
addColumnIfNotExists('orders', 'receipt_url', 'TEXT');
addColumnIfNotExists('orders', 'delivery_address', 'TEXT');
addColumnIfNotExists('orders', 'courier_lat', 'REAL');
addColumnIfNotExists('orders', 'courier_lon', 'REAL');
addColumnIfNotExists('orders', 'shares_deducted', 'INTEGER DEFAULT 0');
addColumnIfNotExists('orders', 'delivery_pin_code', 'TEXT');
addColumnIfNotExists('orders', 'admin_fee', 'REAL DEFAULT 0');
addColumnIfNotExists('orders', 'courier_fee', 'REAL DEFAULT 0');
addColumnIfNotExists('orders', 'seller_net', 'REAL DEFAULT 0');
addColumnIfNotExists('orders', 'delivery_fee', 'REAL DEFAULT 0');
addColumnIfNotExists('orders', 'delivery_distance_km', 'REAL DEFAULT 0');
addColumnIfNotExists('orders', 'products_price', 'REAL DEFAULT 0');
addColumnIfNotExists('orders', 'cash_received_by_seller', 'INTEGER DEFAULT 0');
addColumnIfNotExists('orders', 'cash_received_at', 'DATETIME');

addColumnIfNotExists('payments', 'order_id', 'INTEGER');
addColumnIfNotExists('products', 'stock', 'INTEGER DEFAULT 10');

// Give existing demo sellers a positive initial balance if 0 so demo works out of the box
try {
  db.exec(`UPDATE users SET seller_balance = 500000 WHERE role = 'seller' AND (seller_balance IS NULL OR seller_balance = 0) AND telegram_id = 999001`);
  db.exec(`UPDATE users SET lat = 41.2858, lon = 69.2035, address = 'Chilonzor tumani, 9-kvartal' WHERE role = 'seller' AND telegram_id = 999001 AND lat IS NULL`);
  db.exec(`UPDATE users SET is_seller_approved = 1 WHERE role = 'seller' OR role = 'admin' OR telegram_id = 8354505239`);
  db.exec(`UPDATE users SET is_courier_approved = 1 WHERE role = 'courier' OR role = 'admin' OR telegram_id = 8354505239`);
} catch (e) {}

// Initialize system settings
const initSetting = (key, val) => {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
    if (!row) {
      db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run(key, String(val));
    }
  } catch (e) {}
};
initSetting('admin_fee_percent', '5');
initSetting('courier_price_per_km', '3000');

function getCommissionRates() {
  try {
    const adminRow = db.prepare("SELECT value FROM app_settings WHERE key = 'admin_fee_percent'").get();
    const perKmRow = db.prepare("SELECT value FROM app_settings WHERE key = 'courier_price_per_km'").get();

    const parsedAdmin = adminRow?.value != null ? Number(adminRow.value) : 5;
    const adminPct = Number.isFinite(parsedAdmin) ? Math.max(0, Math.min(99, parsedAdmin)) : 5;
    const parsedPerKm = perKmRow?.value != null ? Number(perKmRow.value) : 3000;
    const courierPricePerKm = Number.isFinite(parsedPerKm) ? Math.max(0, Math.round(parsedPerKm)) : 3000;
    const sellerPct = Math.max(0, 100 - adminPct);

    return {
      adminPct,
      sellerPct,
      courierPricePerKm,
      totalCommissionPct: adminPct
    };
  } catch (e) {
    return {
      adminPct: 5,
      sellerPct: 95,
      courierPricePerKm: 3000,
      totalCommissionPct: 5
    };
  }
}

console.log('✅ SQLite database initialized using native node:sqlite');

db.getCommissionRates = getCommissionRates;
module.exports = db;
