const db = require('./database');

// Do'kon/Sotuvchi qo'shish (agar yo'q bo'lsa)
let seller = db.prepare("SELECT * FROM users WHERE role = 'seller'").get();
if (!seller) {
  const r = db.prepare(`
    INSERT INTO users (telegram_id, role, first_name, last_name, point_name, card_number, card_holder, total_earned, total_orders)
    VALUES (999001, 'seller', 'Rayhon', 'Fast Food', 'Rayhon Milliy Taomlari (Chilonzor)', '8600 5555 4444 3333', 'RAYHON RESTORAN', 450000, 6)
  `).run();
  seller = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  console.log('✅ Demo seller created:', seller.id);
}

// Kategoriyalar
let catPizza = db.prepare('SELECT * FROM categories WHERE seller_id = ? AND name = ?').get(seller.id, '🍕 Pitsalar');
if (!catPizza) {
  const r = db.prepare('INSERT INTO categories (seller_id, name) VALUES (?, ?)').run(seller.id, '🍕 Pitsalar');
  catPizza = { id: r.lastInsertRowid };
}

let catLavash = db.prepare('SELECT * FROM categories WHERE seller_id = ? AND name = ?').get(seller.id, '🌯 Lavashlar');
if (!catLavash) {
  const r = db.prepare('INSERT INTO categories (seller_id, name) VALUES (?, ?)').run(seller.id, '🌯 Lavashlar');
  catLavash = { id: r.lastInsertRowid };
}

// Mahsulotlar
const prods = [
  { cat: catPizza.id, name: 'Go\'shtli Maxsus Pitsa', price: 78000, weight: '650 gr' },
  { cat: catPizza.id, name: 'Pishloqli Margarita', price: 62000, weight: '550 gr' },
  { cat: catLavash.id, name: 'Mol go\'shtli Big Lavash', price: 36000, weight: '380 gr' },
  { cat: catLavash.id, name: 'Tovuqli Pishloqli Lavash', price: 32000, weight: '340 gr' }
];

for (const p of prods) {
  const exists = db.prepare('SELECT * FROM products WHERE seller_id = ? AND name = ?').get(seller.id, p.name);
  if (!exists) {
    db.prepare('INSERT INTO products (category_id, seller_id, name, price, weight) VALUES (?, ?, ?, ?, ?)')
      .run(p.cat, seller.id, p.name, p.price, p.weight);
  }
}

// Demo kuryer
let courier = db.prepare("SELECT * FROM users WHERE role = 'courier'").get();
if (!courier) {
  db.prepare(`
    INSERT INTO users (telegram_id, role, first_name, last_name, phone, card_number, card_holder, unpaid_amount, total_earned, total_orders)
    VALUES (999002, 'courier', 'Jahongir', 'Kuryer', '+998 90 777 88 99', '8600 1234 5678 9012', 'JAHONGIR KURYER', 125000, 340000, 8)
  `).run();
  console.log('✅ Demo courier created');
}

// Demo mijoz
let customer = db.prepare("SELECT * FROM users WHERE role = 'customer'").get();
if (!customer) {
  db.prepare(`
    INSERT INTO users (telegram_id, role, first_name, last_name, total_orders)
    VALUES (999003, 'customer', 'Sherzod', 'Mijoz', 4)
  `).run();
  console.log('✅ Demo customer created');
}

console.log('🎉 Seed data populated successfully!');
