const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { readStore, saveStore, hasMenuData } = require('./database');

const ROOT = __dirname;
const PUBLIC_ROOT = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const PORT = Number(process.env.PORT || 3000);
const DELIVERY_FEE = 15;
const SESSION_TTL = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const validStatuses = ['received', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

function loadEnvFile() {
  try {
    const contents = require('node:fs').readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}
loadEnvFile();
let adminPassword = process.env.MIMIZ_ADMIN_PASSWORD;
if (!adminPassword) {
  adminPassword = crypto.randomBytes(14).toString('base64url');
  console.log('\nStaff password for this run: ' + adminPassword + '\nSave it in .env as MIMIZ_ADMIN_PASSWORD to keep a stable password.\n');
}

const seedMenu = [
  { id: 'jollof', name: 'Smoky jollof rice', category: 'Local', description: 'A rich, gently spiced favourite with that just-right smoky finish.', price: 77, image: 'assets/img/food/jollof-featured.png', tag: 'A Mimiz favourite', available: true },
  { id: 'waakye', name: 'Waakye special', category: 'Local', description: 'Hearty, comforting and full of familiar flavour.', price: 65, image: 'assets/img/lunch/waakye-1.jpeg', tag: 'Local favourite', available: true },
  { id: 'fried-rice', name: 'Fried rice', category: 'Local', description: 'Fragrant rice tossed with vegetables for a satisfying plate.', price: 77, image: 'assets/img/lunch/f-rice-1.jpeg', available: true },
  { id: 'yam', name: 'Yam & sauce', category: 'Local', description: 'Golden yam with a delicious savoury sauce on the side.', price: 34, image: 'assets/img/lunch/b-yam.jpeg', available: true },
  { id: 'tilapia', name: 'Grilled tilapia', category: 'Local', description: 'A Ghanaian classic, grilled until tender and flavourful.', price: 85, image: 'assets/img/menus-cats/grilled tilapia.webp', tag: 'House special', available: true },
  { id: 'tea-bread', name: 'Tea & bread', category: 'Breakfast', description: 'A familiar, comforting start to the day.', price: 20, image: 'assets/img/breaakfast/bft-1.jpeg', available: true },
  { id: 'coffee', name: 'Coffee', category: 'Breakfast', description: 'A warm cup to ease into the morning.', price: 20, image: 'assets/img/breaakfast/bft-2.jpeg', available: true },
  { id: 'fried-egg', name: 'Fried egg', category: 'Breakfast', description: 'A simple breakfast favourite, cooked fresh.', price: 15, image: 'assets/img/breaakfast/bft-3.jpeg', available: true },
  { id: 'spring-roll', name: 'Spring rolls', category: 'Sides', description: 'Crisp, savoury bites that are lovely to share.', price: 25, image: 'assets/img/breaakfast/bft-6.jpeg', available: true },
  { id: 'amarula', name: 'Amarula', category: 'Sides', description: 'A little something sweet to round things off.', price: 30, image: 'assets/img/STATER/amarula.jpeg', available: true },
  { id: 'fanta', name: 'Fanta', category: 'Drinks', description: 'A chilled, fizzy favourite.', price: 22, image: 'assets/img/drinks/fanta.jpeg', available: true },
  { id: 'bel-aqua', name: 'Bel Aqua', category: 'Drinks', description: 'Still water, served chilled.', price: 10, image: 'assets/img/drinks/b-aqua.jpeg', available: true }
];

let store;
let writeQueue = Promise.resolve();
async function initStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const databaseHasMenu = hasMenuData();
  if (databaseHasMenu) {
    store = readStore();
  } else {
    try {
      store = JSON.parse(await fs.readFile(STORE_FILE, 'utf8'));
      if (!Array.isArray(store.menu) || !Array.isArray(store.orders)) throw new Error('Invalid legacy store data');
    } catch (error) {
      if (error.code !== 'ENOENT' && error instanceof SyntaxError) await fs.rename(STORE_FILE, STORE_FILE + '.corrupt-' + Date.now()).catch(() => {});
      store = { menu: seedMenu, orders: [], chats: [], customerSessions: [] };
    }
  }
  let changed = false;
  store.chats = Array.isArray(store.chats) ? store.chats : [];
  store.customerSessions = Array.isArray(store.customerSessions) ? store.customerSessions : [];
  const defaults = new Map(seedMenu.map(item => [item.id, item]));
  store.menu = store.menu.map(item => { const base = defaults.get(item.id); const updated = base ? { ...base, ...item } : item; if (item.id === 'jollof') updated.image = 'assets/img/food/jollof-featured.png'; if (!item.category) updated.category = 'Local'; if (updated.archived === undefined) updated.archived = false; if (JSON.stringify(updated) !== JSON.stringify(item)) changed = true; return updated; });
  for (const order of store.orders) { if (!Array.isArray(order.statusHistory)) { order.statusHistory = [{ status: order.status || 'received', at: order.updatedAt || order.createdAt || new Date().toISOString() }]; changed = true; } if (!order.estimatedMinutes) { order.estimatedMinutes = order.fulfilment === 'delivery' ? 50 : 25; changed = true; } }
  if (!databaseHasMenu || changed) await persist();
}
function persist() {
  const snapshot = structuredClone(store);
  writeQueue = writeQueue.then(() => saveStore(snapshot));
  return writeQueue;
}
function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 3_200_000) {
        reject(Object.assign(new Error('Request is too large.'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(Object.assign(new Error('Send valid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function text(value, max = 120) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
async function saveMenuImage(data) {
  if (typeof data !== 'string' || data.length > 2_800_000) throw Object.assign(new Error('Choose an image smaller than 2 MB.'), { status: 400 });
  const match = data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error('Use a JPEG, PNG, or WebP image.'), { status: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 2_000_000) throw Object.assign(new Error('Choose an image smaller than 2 MB.'), { status: 400 });
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const imagePath = 'assets/img/menu/item-' + crypto.randomBytes(8).toString('hex') + '.' + ext;
  const destination = path.join(ROOT, imagePath);
  const servedCopy = path.join(PUBLIC_ROOT, imagePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(path.dirname(servedCopy), { recursive: true });
  await Promise.all([fs.writeFile(destination, buffer), fs.writeFile(servedCopy, buffer)]);
  return imagePath;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function sessionId(req) {
  const cookie = req.headers.cookie || '';
  return cookie.split(';').map(x => x.trim()).find(x => x.startsWith('mimiz_staff='))?.slice('mimiz_staff='.length) || '';
}
function readCookie(req, name) {
  const prefix = name + '=';
  return (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(prefix))?.slice(prefix.length) || '';
}
function customerVisitor(req, res) {
  const token = readCookie(req, 'mimiz_visitor');
  const found = token && /^[A-Za-z0-9_-]{40,60}$/.test(token) ? store.customerSessions.find(item => item.visitorHash === digest(token)) : null;
  if (found) return { visitorHash: found.visitorHash, cookie: null };
  const nextToken = crypto.randomBytes(32).toString('base64url');
  const visitorHash = digest(nextToken);
  const now = new Date().toISOString();
  store.customerSessions.push({ visitorHash, createdAt: now, lastSeenAt: now });
  const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return { visitorHash, cookie: 'mimiz_visitor=' + nextToken + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=15552000' + secure };
}
function safeChat(chat) { const { accessHash, visitorHash, ...visible } = chat; return visible; }
function tokenMatches(hash, token) {
  if (!hash || !token) return false;
  const expected = Buffer.from(hash); const candidate = Buffer.from(digest(token));
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}
function isStaff(req) {
  const id = sessionId(req);
  const expires = sessions.get(id);
  if (!expires || expires < Date.now()) { sessions.delete(id); return false; }
  return true;
}
function clientIp(req) { return req.socket.remoteAddress || 'unknown'; }
function safeOrder(order) {
  const { accessHash, visitorHash, ...visible } = order;
  return visible;
}
function fail(res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  sendJson(res, status, { error: status >= 500 ? 'Something went wrong. Please try again.' : error.message });
}
async function staticFile(req, res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { res.writeHead(400); res.end('Bad path'); return; }
  const requested = decoded === '/' ? '/index.html' : decoded;
  const fullPath = path.resolve(PUBLIC_ROOT, '.' + requested);
  const relative = path.relative(PUBLIC_ROOT, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) throw new Error('Not a file');
    const ext = path.extname(fullPath).toLowerCase();
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'content-length': stat.size, 'x-content-type-options': 'nosniff', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(await fs.readFile(fullPath));
  } catch {
    if (!path.extname(decoded)) {
      try { const app = await fs.readFile(path.join(PUBLIC_ROOT, 'index.html')); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(app); } catch {}
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Page not found');
  }
}

async function handler(req, res) {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const method = req.method.toUpperCase();
  try {
    if (url.pathname.startsWith('/api/')) {
      if (method !== 'GET' && !sameOrigin(req)) return sendJson(res, 403, { error: 'Cross-origin request blocked.' });

      if (url.pathname === '/api/health' && method === 'GET') return sendJson(res, 200, { status: 'ok' });
      if (url.pathname === '/api/menu' && method === 'GET') return sendJson(res, 200, { items: store.menu.filter(item => !item.archived) });
      if (url.pathname === '/api/orders' && method === 'GET') {
        const session = customerVisitor(req, res);
        if (session.cookie) await persist();
        const orders = store.orders.filter(order => order.visitorHash === session.visitorHash).map(safeOrder);
        return sendJson(res, 200, { orders }, session.cookie ? { 'set-cookie': session.cookie } : {});
      }
      if (url.pathname === '/api/orders/attach' && method === 'POST') {
        const body = await readBody(req);
        if (!Array.isArray(body.orders) || body.orders.length > 30) throw Object.assign(new Error('Invalid order history.'), { status: 400 });
        const session = customerVisitor(req, res);
        let attached = false;
        for (const ref of body.orders) {
          const order = store.orders.find(item => item.id === ref.id);
          if (order && tokenMatches(order.accessHash, String(ref.key || ''))) { order.visitorHash = session.visitorHash; attached = true; }
        }
        if (attached || session.cookie) await persist();
        return sendJson(res, 200, { orders: store.orders.filter(order => order.visitorHash === session.visitorHash).map(safeOrder) }, session.cookie ? { 'set-cookie': session.cookie } : {});
      }

      if (url.pathname === '/api/orders' && method === 'POST') {
        const body = await readBody(req);
        if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 40) throw Object.assign(new Error('Your basket is empty or has too many items.'), { status: 400 });
        const fulfilment = body.fulfilment;
        if (!['pickup', 'delivery'].includes(fulfilment)) throw Object.assign(new Error('Choose pickup or delivery.'), { status: 400 });
        const customer = body.customer || {};
        const name = text(customer.name, 80);
        const phone = text(customer.phone, 30);
        const area = text(customer.area, 100);
        const address = text(customer.address, 180);
        const notes = text(customer.notes, 500);
        if (name.length < 2 || phone.replace(/\D/g, '').length < 7 || !area) throw Object.assign(new Error('Enter your name, a valid phone number, and your area.'), { status: 400 });
        if (fulfilment === 'delivery' && address.length < 5) throw Object.assign(new Error('Enter a delivery address.'), { status: 400 });
        const requested = new Map();
        for (const line of body.items) {
          if (!line || typeof line.id !== 'string' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) throw Object.assign(new Error('One of the item quantities is invalid.'), { status: 400 });
          requested.set(line.id, (requested.get(line.id) || 0) + line.quantity);
        }
        const orderItems = [];
        for (const [id, quantity] of requested) {
          const product = store.menu.find(item => item.id === id);
          if (!product || !product.available) throw Object.assign(new Error('An item in your basket is no longer available. Refresh the menu and try again.'), { status: 409 });
          orderItems.push({ id, name: product.name, price: product.price, image: product.image, quantity, lineTotal: product.price * quantity });
        }
        const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
        const delivery = fulfilment === 'delivery' ? DELIVERY_FEE : 0;
        const accessToken = crypto.randomBytes(32).toString('base64url');
        const customerSession = customerVisitor(req, res);
        const order = {
          id: 'MM-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          createdAt: new Date().toISOString(), status: 'received',
          statusHistory: [{ status: 'received', at: new Date().toISOString() }],
          estimatedMinutes: fulfilment === 'pickup' ? 25 : 50,
          customer: { name, phone, area, address, notes }, fulfilment,
          paymentMethod: fulfilment === 'pickup' ? 'Pay when you collect' : 'Pay on delivery',
          items: orderItems, subtotal, delivery, total: subtotal + delivery,
          accessHash: digest(accessToken), visitorHash: customerSession.visitorHash
        };
        store.orders.unshift(order);
        await persist();
        return sendJson(res, 201, { order: safeOrder(order), accessToken }, customerSession.cookie ? { 'set-cookie': customerSession.cookie } : {});
      }

      if (url.pathname === '/api/chat/current' && method === 'GET') {
        const session = customerVisitor(req, res);
        const chat = store.chats.find(item => item.visitorHash === session.visitorHash && item.status === 'open') || null;
        if (session.cookie) await persist();
        return sendJson(res, 200, { chat: chat ? safeChat(chat) : null }, session.cookie ? { 'set-cookie': session.cookie } : {});
      }
      if (url.pathname === '/api/chat/attach' && method === 'POST') {
        const body = await readBody(req);
        const session = customerVisitor(req, res);
        const chat = store.chats.find(item => item.id === body.chatId);
        if (!chat || !tokenMatches(chat.accessHash, String(body.key || ''))) throw Object.assign(new Error('Previous chat could not be restored.'), { status: 404 });
        chat.visitorHash = session.visitorHash;
        chat.updatedAt = new Date().toISOString();
        await persist();
        return sendJson(res, 200, { chat: safeChat(chat) }, session.cookie ? { 'set-cookie': session.cookie } : {});
      }
      if (url.pathname === '/api/chat/messages' && method === 'POST') {
        const body = await readBody(req);
        const message = text(body.message, 500);
        if (message.length < 1) throw Object.assign(new Error('Write a message first.'), { status: 400 });
        const session = customerVisitor(req, res);
        let chat;
        if (body.chatId) {
          chat = store.chats.find(item => item.id === body.chatId);
          if (!chat || !tokenMatches(chat.accessHash, String(body.key || ''))) throw Object.assign(new Error('Chat session not found. Start a new chat.'), { status: 404 });
          if (chat.status === 'closed') throw Object.assign(new Error('This conversation is closed. Start a new chat.'), { status: 409 });
          chat.visitorHash = session.visitorHash;
        } else {
          chat = store.chats.find(item => item.visitorHash === session.visitorHash && item.status === 'open');
          if (!chat) {
            const now = new Date().toISOString();
            chat = { id: 'CH-' + crypto.randomBytes(4).toString('hex').toUpperCase(), accessHash: digest(crypto.randomBytes(32).toString('base64url')), visitorHash: session.visitorHash, createdAt: now, updatedAt: now, status: 'open', messages: [] };
            store.chats.unshift(chat);
          }
        }
        if (chat.messages.length >= 500) throw Object.assign(new Error('This chat is full. Please contact the kitchen by phone.'), { status: 409 });
        chat.messages.push({ sender: 'customer', message, createdAt: new Date().toISOString() });
        chat.updatedAt = new Date().toISOString();
        await persist();
        return sendJson(res, 201, { chat: safeChat(chat) }, session.cookie ? { 'set-cookie': session.cookie } : {});
      }
      const customerChat = url.pathname.match(/^\/api\/chat\/([A-Z0-9-]+)$/);
      if (customerChat && method === 'GET') {
        const chat = store.chats.find(item => item.id === customerChat[1]);
        const key = url.searchParams.get('key') || '';
        if (!chat || !tokenMatches(chat.accessHash, key)) throw Object.assign(new Error('Chat not found.'), { status: 404 });
        return sendJson(res, 200, { chat: safeChat(chat) });
      }

      const customerOrder = url.pathname.match(/^\/api\/orders\/([A-Za-z0-9-]+)$/);
      if (customerOrder && method === 'GET') {
        const order = store.orders.find(item => item.id === customerOrder[1]);
        const token = url.searchParams.get('key') || '';
        if (!order || !token || !crypto.timingSafeEqual(Buffer.from(order.accessHash), Buffer.from(digest(token)))) throw Object.assign(new Error('Order not found. Check the order link saved on this device.'), { status: 404 });
        return sendJson(res, 200, { order: safeOrder(order) });
      }

      if (url.pathname === '/api/admin/login' && method === 'POST') {
        const ip = clientIp(req);
        const attempt = loginAttempts.get(ip) || { count: 0, until: Date.now() + 10 * 60 * 1000 };
        if (attempt.until < Date.now()) { attempt.count = 0; attempt.until = Date.now() + 10 * 60 * 1000; }
        if (attempt.count >= 8) throw Object.assign(new Error('Too many attempts. Wait a few minutes and try again.'), { status: 429 });
        const body = await readBody(req);
        const candidate = String(body.password || '');
        const expectedHash = crypto.createHash('sha256').update(adminPassword).digest();
        const candidateHash = crypto.createHash('sha256').update(candidate).digest();
        if (!crypto.timingSafeEqual(expectedHash, candidateHash)) {
          attempt.count++;
          loginAttempts.set(ip, attempt);
          throw Object.assign(new Error('That staff password is not correct.'), { status: 401 });
        }
        loginAttempts.delete(ip);
        const sid = crypto.randomBytes(32).toString('base64url');
        sessions.set(sid, Date.now() + SESSION_TTL);
        return sendJson(res, 200, { ok: true }, { 'set-cookie': 'mimiz_staff=' + sid + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + Math.floor(SESSION_TTL / 1000) });
      }
      if (url.pathname === '/api/admin/logout' && method === 'POST') {
        sessions.delete(sessionId(req));
        return sendJson(res, 200, { ok: true }, { 'set-cookie': 'mimiz_staff=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      }
      if (url.pathname === '/api/admin/me' && method === 'GET') return isStaff(req) ? sendJson(res, 200, { ok: true }) : sendJson(res, 401, { error: 'Sign in required.' });
      if (url.pathname.startsWith('/api/admin/')) {
        if (!isStaff(req)) return sendJson(res, 401, { error: 'Staff sign in required.' });
        if (url.pathname === '/api/admin/orders' && method === 'GET') return sendJson(res, 200, { orders: store.orders.map(safeOrder) });
        if (url.pathname === '/api/admin/chats' && method === 'GET') return sendJson(res, 200, { chats: store.chats.map(safeChat) });
        if (url.pathname === '/api/admin/menu' && method === 'GET') return sendJson(res, 200, { items: store.menu });
        if (url.pathname === '/api/admin/menu' && method === 'POST') {
          const body = await readBody(req);
          const name = text(body.name, 70);
          const category = text(body.category, 30);
          const description = text(body.description, 240);
          const price = Number(body.price);
          if (name.length < 2 || !category || !description) throw Object.assign(new Error('Enter a dish name, category, and description.'), { status: 400 });
          if (!Number.isFinite(price) || price < 1 || price > 5000) throw Object.assign(new Error('Set a price between GH₵1 and GH₵5,000.'), { status: 400 });
          const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'dish';
          const id = idBase + '-' + crypto.randomBytes(3).toString('hex');
          const image = body.imageData ? await saveMenuImage(body.imageData) : text(body.image, 300);
          const item = { id, name, category, description, price: Math.round(price * 100) / 100, image: image || 'assets/img/food/jollof-featured.png', tag: text(body.tag, 32), available: true, archived: false };
          store.menu.push(item); await persist();
          return sendJson(res, 201, { item });
        }
        const adminChat = url.pathname.match(/^\/api\/admin\/chats\/([A-Z0-9-]+)\/messages$/);
        if (adminChat && method === 'POST') {
          const body = await readBody(req);
          const message = text(body.message, 500);
          if (!message) throw Object.assign(new Error('Write a reply first.'), { status: 400 });
          const chat = store.chats.find(item => item.id === adminChat[1]);
          if (!chat) throw Object.assign(new Error('Chat not found.'), { status: 404 });
          chat.messages.push({ sender: 'staff', message, createdAt: new Date().toISOString() });
          chat.updatedAt = new Date().toISOString();
          chat.status = 'open';
          await persist();
          return sendJson(res, 201, { ok: true });
        }
        const closeChat = url.pathname.match(/^\/api\/admin\/chats\/([A-Z0-9-]+)$/);
        if (closeChat && method === 'PATCH') {
          const body = await readBody(req);
          if (!['open', 'closed'].includes(body.status)) throw Object.assign(new Error('Choose a valid chat status.'), { status: 400 });
          const chat = store.chats.find(item => item.id === closeChat[1]);
          if (!chat) throw Object.assign(new Error('Chat not found.'), { status: 404 });
          chat.status = body.status; chat.updatedAt = new Date().toISOString(); await persist();
          return sendJson(res, 200, { chat: { id: chat.id, status: chat.status } });
        }
        const statusRoute = url.pathname.match(/^\/api\/admin\/orders\/([A-Za-z0-9-]+)$/);
        if (statusRoute && method === 'PATCH') {
          const body = await readBody(req);
          if (!validStatuses.includes(body.status)) throw Object.assign(new Error('Choose a valid order status.'), { status: 400 });
          const order = store.orders.find(item => item.id === statusRoute[1]);
          if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
          const changedAt = new Date().toISOString();
          if (order.status !== body.status) order.statusHistory.push({ status: body.status, at: changedAt });
          order.status = body.status;
          order.updatedAt = changedAt;
          await persist();
          return sendJson(res, 200, { order: safeOrder(order) });
        }
        const menuRoute = url.pathname.match(/^\/api\/admin\/menu\/([a-z0-9-]+)$/);
        if (menuRoute && method === 'PATCH') {
          const body = await readBody(req);
          const item = store.menu.find(product => product.id === menuRoute[1]);
          if (!item) throw Object.assign(new Error('Menu item not found.'), { status: 404 });
          let changed = false;
          if (Object.hasOwn(body, 'available')) {
            if (typeof body.available !== 'boolean') throw Object.assign(new Error('Choose whether this item is available.'), { status: 400 });
            item.available = body.available; changed = true;
          }
          if (Object.hasOwn(body, 'price')) {
            const price = Number(body.price);
            if (!Number.isFinite(price) || price < 1 || price > 5000) throw Object.assign(new Error('Set a price between GH₵1 and GH₵5,000.'), { status: 400 });
            item.price = Math.round(price * 100) / 100; changed = true;
          }
          if (Object.hasOwn(body, 'name')) {
            const name = text(body.name, 70);
            if (name.length < 2) throw Object.assign(new Error('Menu names need at least two characters.'), { status: 400 });
            item.name = name; changed = true;
          }
          if (Object.hasOwn(body, 'description')) {
            item.description = text(body.description, 240); changed = true;
          }
          if (Object.hasOwn(body, 'tag')) { item.tag = text(body.tag, 32); changed = true; }
          if (Object.hasOwn(body, 'imageData')) { item.image = await saveMenuImage(body.imageData); changed = true; }
          else if (Object.hasOwn(body, 'image')) { item.image = text(body.image, 300); changed = true; }
          if (Object.hasOwn(body, 'archived')) { if (typeof body.archived !== 'boolean') throw Object.assign(new Error('Choose whether to archive this dish.'), { status: 400 }); item.archived = body.archived; changed = true; }
          if (Object.hasOwn(body, 'category')) {
            const category = text(body.category, 30);
            if (category.length < 2) throw Object.assign(new Error('Enter a category name.'), { status: 400 });
            item.category = category; changed = true;
          }
          if (!changed) throw Object.assign(new Error('There are no menu changes to save.'), { status: 400 });
          await persist();
          return sendJson(res, 200, { item });
        }
      }
      return sendJson(res, 404, { error: 'API route not found.' });
    }

    if (method !== 'GET' && method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end('Method not allowed'); }
    const legacyRoutes = { '/index.html': '/', '/home.html': '/', '/cart.html': '/cart', '/orders.html': '/orders', '/staff.html': '/staff' };
    if (legacyRoutes[url.pathname]) { res.writeHead(302, { location: legacyRoutes[url.pathname], 'cache-control': 'no-store' }); return res.end(); }
    return staticFile(req, res, url.pathname);
  } catch (error) {
    return fail(res, error);
  }
}

initStore().then(() => {
  const server = http.createServer(handler);
  server.listen(PORT, '127.0.0.1', () => console.log('Mimiz Kitchen is running at http://localhost:' + PORT));
  server.on('close', () => { for (const session of sessions.keys()) sessions.delete(session); });
}).catch(error => { console.error('Could not start Mimiz Kitchen:', error); process.exitCode = 1; });
