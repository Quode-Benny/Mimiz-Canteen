const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const directory = path.join(__dirname, 'data');
fs.mkdirSync(directory, { recursive: true });
const database = new Database(path.join(directory, 'mimiz.sqlite'), { timeout: 5000 });
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(
  "CREATE TABLE IF NOT EXISTS menu_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price REAL NOT NULL CHECK(price >= 0), image TEXT NOT NULL DEFAULT '', tag TEXT NOT NULL DEFAULT '', available INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0);" +
  "CREATE TABLE IF NOT EXISTS customer_sessions (visitor_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL);" +
  "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, access_hash TEXT NOT NULL, visitor_hash TEXT REFERENCES customer_sessions(visitor_hash), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL, estimated_minutes INTEGER NOT NULL, customer_json TEXT NOT NULL, fulfilment TEXT NOT NULL, payment_method TEXT NOT NULL, subtotal REAL NOT NULL, delivery REAL NOT NULL, total REAL NOT NULL);" +
  "CREATE INDEX IF NOT EXISTS orders_visitor_created_idx ON orders(visitor_hash, created_at);" +
  "CREATE TABLE IF NOT EXISTS order_items (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, seq INTEGER NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL, price REAL NOT NULL, image TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL, line_total REAL NOT NULL, PRIMARY KEY(order_id, seq));" +
  "CREATE TABLE IF NOT EXISTS order_status_history (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, seq INTEGER NOT NULL, status TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY(order_id, seq));" +
  "CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, access_hash TEXT NOT NULL, visitor_hash TEXT REFERENCES customer_sessions(visitor_hash), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, status TEXT NOT NULL);" +
  "CREATE INDEX IF NOT EXISTS chats_visitor_status_idx ON chats(visitor_hash, status, updated_at);" +
  "CREATE TABLE IF NOT EXISTS chat_messages (chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE, seq INTEGER NOT NULL, sender TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(chat_id, seq));"
);

function readStore() {
  const menu = database.prepare('SELECT * FROM menu_items ORDER BY rowid').all().map(row => ({
    id: row.id, name: row.name, category: row.category, description: row.description,
    price: row.price, image: row.image, tag: row.tag || undefined,
    available: Boolean(row.available), archived: Boolean(row.archived)
  }));
  const orders = database.prepare('SELECT * FROM orders ORDER BY created_at DESC').all().map(row => ({
    id: row.id, accessHash: row.access_hash, visitorHash: row.visitor_hash || undefined, createdAt: row.created_at,
    updatedAt: row.updated_at, status: row.status, estimatedMinutes: row.estimated_minutes,
    customer: JSON.parse(row.customer_json), fulfilment: row.fulfilment,
    paymentMethod: row.payment_method, subtotal: row.subtotal, delivery: row.delivery,
    total: row.total,
    items: database.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY seq').all(row.id).map(item => ({
      id: item.product_id, name: item.name, price: item.price, image: item.image,
      quantity: item.quantity, lineTotal: item.line_total
    })),
    statusHistory: database.prepare('SELECT status, at FROM order_status_history WHERE order_id = ? ORDER BY seq').all(row.id)
  }));
  const customerSessions = database.prepare('SELECT visitor_hash AS visitorHash, created_at AS createdAt, last_seen_at AS lastSeenAt FROM customer_sessions').all();
  const chats = database.prepare('SELECT * FROM chats ORDER BY updated_at DESC').all().map(row => ({
    id: row.id, accessHash: row.access_hash, visitorHash: row.visitor_hash || undefined,
    createdAt: row.created_at, updatedAt: row.updated_at, status: row.status,
    messages: database.prepare('SELECT sender, message, created_at AS createdAt FROM chat_messages WHERE chat_id = ? ORDER BY seq').all(row.id)
  }));
  return { menu, orders, chats, customerSessions };
}

const writeSnapshot = database.transaction((store) => {
  database.exec('DELETE FROM chat_messages; DELETE FROM chats; DELETE FROM order_items; DELETE FROM order_status_history; DELETE FROM orders; DELETE FROM menu_items; DELETE FROM customer_sessions;');
  const sessionInsert = database.prepare('INSERT INTO customer_sessions(visitor_hash, created_at, last_seen_at) VALUES (@visitorHash, @createdAt, @lastSeenAt)');
  for (const session of store.customerSessions || []) sessionInsert.run(session);
  const menuInsert = database.prepare('INSERT INTO menu_items(id,name,category,description,price,image,tag,available,archived) VALUES (@id,@name,@category,@description,@price,@image,@tag,@available,@archived)');
  for (const item of store.menu) menuInsert.run({ id:item.id,name:item.name,category:item.category || 'Local',description:item.description || '',price:Number(item.price),image:item.image || '',tag:item.tag || '',available:item.available ? 1 : 0,archived:item.archived ? 1 : 0 });
  const orderInsert = database.prepare('INSERT INTO orders(id,access_hash,visitor_hash,created_at,updated_at,status,estimated_minutes,customer_json,fulfilment,payment_method,subtotal,delivery,total) VALUES (@id,@accessHash,@visitorHash,@createdAt,@updatedAt,@status,@estimatedMinutes,@customerJson,@fulfilment,@paymentMethod,@subtotal,@delivery,@total)');
  const itemInsert = database.prepare('INSERT INTO order_items(order_id,seq,product_id,name,price,image,quantity,line_total) VALUES (@orderId,@seq,@productId,@name,@price,@image,@quantity,@lineTotal)');
  const historyInsert = database.prepare('INSERT INTO order_status_history(order_id,seq,status,at) VALUES (@orderId,@seq,@status,@at)');
  for (const order of store.orders) {
    orderInsert.run({ id:order.id,accessHash:order.accessHash,visitorHash:order.visitorHash || null,createdAt:order.createdAt,updatedAt:order.updatedAt || order.createdAt,status:order.status,estimatedMinutes:order.estimatedMinutes || 25,customerJson:JSON.stringify(order.customer),fulfilment:order.fulfilment,paymentMethod:order.paymentMethod,subtotal:order.subtotal,delivery:order.delivery,total:order.total });
    (order.items || []).forEach((item,seq) => itemInsert.run({ orderId:order.id,seq,productId:item.id,name:item.name,price:item.price,image:item.image || '',quantity:item.quantity,lineTotal:item.lineTotal }));
    (order.statusHistory || []).forEach((entry,seq) => historyInsert.run({ orderId:order.id,seq,status:entry.status,at:entry.at }));
  }
  const chatInsert = database.prepare('INSERT INTO chats(id,access_hash,visitor_hash,created_at,updated_at,status) VALUES (@id,@accessHash,@visitorHash,@createdAt,@updatedAt,@status)');
  const messageInsert = database.prepare('INSERT INTO chat_messages(chat_id,seq,sender,message,created_at) VALUES (@chatId,@seq,@sender,@message,@createdAt)');
  for (const chat of store.chats || []) {
    chatInsert.run({ id:chat.id,accessHash:chat.accessHash,visitorHash:chat.visitorHash || null,createdAt:chat.createdAt,updatedAt:chat.updatedAt,status:chat.status });
    (chat.messages || []).forEach((message,seq) => messageInsert.run({ chatId:chat.id,seq,sender:message.sender,message:message.message,createdAt:message.createdAt }));
  }
});
function saveStore(store) { writeSnapshot(store); }
function hasMenuData() { return database.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count > 0; }
module.exports = { database, readStore, saveStore, hasMenuData };
