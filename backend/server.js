const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const Stripe = require('stripe');
const crypto = require('crypto');

// Load environment variables from .env file if present
dotenv.config();

/*
 * SoulSeer backend
 *
 * This server implements the core API endpoints and real‑time signaling
 * required by the SoulSeer platform. It handles user sessions, billing
 * via Stripe, and WebRTC signaling through Socket.io. Persistent data
 * is stored in a Neon (PostgreSQL) database. Clerk authentication
 * should be integrated in production – the verifyAuth middleware
 * currently only validates that an Authorization header exists and
 * extracts the token as the userId.
 */

// Initialize Stripe with the secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Create tables if they do not exist
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      clerk_id TEXT UNIQUE,
      email TEXT UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('client','reader','admin')),
      name TEXT,
      stripe_customer_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES users(id),
      reader_id INTEGER REFERENCES users(id),
      room_id TEXT NOT NULL,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      total_minutes INTEGER,
      rate_per_minute NUMERIC(10,2),
      amount_charged NUMERIC(10,2),
      status TEXT NOT NULL CHECK (status IN ('active','complete','cancelled'))
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payouts (
      id SERIAL PRIMARY KEY,
      reader_id INTEGER REFERENCES users(id),
      amount NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Generic direct messaging between users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id),
      receiver_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Live streaming sessions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS streams (
      id SERIAL PRIMARY KEY,
      reader_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      start_time TIMESTAMP DEFAULT NOW(),
      end_time TIMESTAMP,
      status TEXT NOT NULL CHECK (status IN ('active','ended')),
      viewer_count INTEGER DEFAULT 0
    );
  `);
  // Gifts catalogue for live streams
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gifts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT,
      value NUMERIC(10,2) NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stream_gifts (
      id SERIAL PRIMARY KEY,
      stream_id INTEGER REFERENCES streams(id),
      user_id INTEGER REFERENCES users(id),
      gift_id INTEGER REFERENCES gifts(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Marketplace tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('digital','physical')),
      name TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL,
      image_url TEXT,
      inventory INTEGER,
      stripe_product_id TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      total_price NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Forum functionality
  await pool.query(`
    CREATE TABLE IF NOT EXISTS forum_topics (
      id SERIAL PRIMARY KEY,
      author_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id SERIAL PRIMARY KEY,
      topic_id INTEGER REFERENCES forum_topics(id),
      author_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed gifts if none exist
  const { rows: giftCountRows } = await pool.query('SELECT COUNT(*) FROM gifts');
  const giftCount = parseInt(giftCountRows[0].count, 10);
  if (giftCount === 0) {
    await pool.query(
      `INSERT INTO gifts (name, image_url, value) VALUES
      ('Rose', 'https://i.postimg.cc/8kksgkgt/rose.png', 2.00),
      ('Star', 'https://i.postimg.cc/yYFcPJVP/star.png', 5.00),
      ('Moon', 'https://i.postimg.cc/YCVLKg04/moon.png', 10.00);
    `,
    );
  }
  // Seed products if none exist
  const { rows: prodCountRows } = await pool.query('SELECT COUNT(*) FROM products');
  const prodCount = parseInt(prodCountRows[0].count, 10);
  if (prodCount === 0) {
    await pool.query(
      `INSERT INTO products (type, name, description, price, image_url, inventory) VALUES
      ('digital', 'Meditation Guide', 'A calming meditation guide for beginners.', 9.99, 'https://i.postimg.cc/6QgRH1Kk/meditation-guide.jpg', NULL),
      ('digital', 'Tarot Spread', 'Downloadable tarot spread template with interpretations.', 4.99, 'https://i.postimg.cc/23HVbnDw/tarot-spread.jpg', NULL),
      ('physical', 'Crystal Set', 'A set of healing crystals for energy work.', 29.99, 'https://i.postimg.cc/zB4FGsCt/crystal-set.jpg', 50),
      ('physical', 'Incense Bundle', 'A bundle of aromatherapy incense sticks.', 14.99, 'https://i.postimg.cc/Zn9DNvZ7/incense.jpg', 100);
    `,
    );
  }
}

// Immediately initialize the database
initDatabase().catch((err) => {
  console.error('Database initialization failed', err);
});

// Express app and Socket.io server setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());

// Authentication middleware
// In production, integrate Clerk SDK to verify JWTs. For now, the userId
// is taken as the Bearer token itself. Admin privileges are checked
// against the users table.
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.substring('Bearer '.length).trim();
  try {
    // Look up user by clerk_id or create them lazily
    let { rows } = await pool.query('SELECT * FROM users WHERE clerk_id = $1', [token]);
    let user;
    if (rows.length === 0) {
      // Auto‑provision user as client by default
      ({ rows } = await pool.query(
        'INSERT INTO users (clerk_id, role) VALUES ($1, $2) RETURNING *',
        [token, 'client'],
      ));
    }
    user = rows[0];
    req.user = user;
    return next();
  } catch (err) {
    console.error('Authentication lookup failed', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// Authorize admin users
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

// WebRTC signaling rooms. Each room stores a mapping of userId to socketId.
const signalingRooms = {};

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('joinRoom', ({ roomId, userId }) => {
    if (!signalingRooms[roomId]) {
      signalingRooms[roomId] = {};
    }
    signalingRooms[roomId][userId] = socket.id;
    socket.join(roomId);
    socket.to(roomId).emit('userJoined', { userId });
  });

  socket.on('signal', ({ roomId, targetId, data }) => {
    const targetSocketId = signalingRooms[roomId]?.[targetId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('signal', { from: socket.id, data });
    }
  });

  socket.on('disconnect', () => {
    for (const [roomId, members] of Object.entries(signalingRooms)) {
      for (const [userId, socketId] of Object.entries(members)) {
        if (socketId === socket.id) {
          delete signalingRooms[roomId][userId];
          socket.to(roomId).emit('userLeft', { userId });
        }
      }
    }
  });

  /**
   * Join a chat room based on two user IDs. The room key is constructed by
   * sorting the IDs and joining with a hyphen. Joining a chat room allows
   * real‑time message updates via the 'newMessage' event.
   */
  socket.on('joinChat', ({ userId, contactId }) => {
    if (!userId || !contactId) return;
    const roomKey = [userId, contactId].sort().join('-');
    socket.join(roomKey);
  });

  /**
   * Join a stream room. When a user joins, increment viewer count in DB.
   */
  socket.on('joinStream', async ({ streamId, userId }) => {
    if (!streamId) return;
    const roomKey = `stream-${streamId}`;
    socket.join(roomKey);
    // Update viewer count asynchronously
    try {
      await pool.query('UPDATE streams SET viewer_count = viewer_count + 1 WHERE id = $1', [streamId]);
    } catch (err) {
      console.error('Failed to increment stream viewer count', err);
    }
  });
});

/**
 * Create a new reading session.
 * Expects readerId and ratePerMinute in the body. Returns sessionId and roomId.
 */
app.post('/api/sessions/start', verifyAuth, async (req, res) => {
  const { readerId, ratePerMinute } = req.body;
  const clientId = req.user.id;
  if (!readerId || !ratePerMinute) {
    return res.status(400).json({ error: 'readerId and ratePerMinute are required' });
  }
  const roomId = crypto.randomUUID();
  const startTime = new Date();
  try {
    const result = await pool.query(
      'INSERT INTO sessions (client_id, reader_id, room_id, start_time, rate_per_minute, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [clientId, readerId, roomId, startTime, ratePerMinute, 'active'],
    );
    const sessionId = result.rows[0].id;
    return res.json({ sessionId, roomId, startTime });
  } catch (err) {
    console.error('Error creating session', err);
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * End an active reading session.
 * Calculates the duration and charges the client.
 */
app.post('/api/sessions/end', verifyAuth, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  const endTime = new Date();
  try {
    const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1 AND status = $2', [sessionId, 'active']);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }
    const session = rows[0];
    // Compute minutes (rounded up)
    const durationMs = endTime - session.start_time;
    const minutes = Math.ceil(durationMs / 60000);
    const amount = minutes * parseFloat(session.rate_per_minute);
    // Update session
    await pool.query(
      'UPDATE sessions SET end_time = $1, total_minutes = $2, amount_charged = $3, status = $4 WHERE id = $5',
      [endTime, minutes, amount, 'complete', sessionId],
    );
    // Charge via Stripe – the client’s Stripe customer ID should be stored on the users table
    const client = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [session.client_id]);
    let customerId = client.rows[0]?.stripe_customer_id;
    let paymentIntent;
    if (customerId) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        customer: customerId,
        description: `SoulSeer session ${sessionId}`,
        automatic_payment_methods: { enabled: true },
      });
    } else {
      // Fallback to normal payment intent requiring payment method from client
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        description: `SoulSeer session ${sessionId}`,
        automatic_payment_methods: { enabled: true },
      });
    }
    return res.json({
      sessionId,
      minutes,
      amount,
      paymentIntentClientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('Error ending session', err);
    return res.status(500).json({ error: 'Failed to end session' });
  }
});

/**
 * Create a payment intent for adding funds or purchasing gifts.
 */
app.post('/api/payment-intent', verifyAuth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });
    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error creating payment intent', err);
    return res.status(500).json({ error: 'Payment intent creation failed' });
  }
});

/**
 * Stripe webhook endpoint. Required to handle asynchronous payment events.
 */
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SIGNING_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('PaymentIntent was successful:', event.data.object.id);
      break;
    case 'payment_intent.payment_failed':
      console.warn('PaymentIntent failed:', event.data.object.id);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.json({ received: true });
});

/**
 * Admin API to list users. Only admin users can access.
 */
app.get('/api/admin/users', verifyAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, role, name, created_at FROM users');
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching users', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Admin API to update a user’s role or details.
 */
app.put('/api/admin/users/:id', verifyAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { role, name, email } = req.body;
  try {
    await pool.query(
      'UPDATE users SET role = COALESCE($1, role), name = COALESCE($2, name), email = COALESCE($3, email) WHERE id = $4',
      [role, name, email, userId],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating user', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * Admin API to create a new user. Used for adding reader accounts via the admin dashboard.
 * This route inserts a new record into the users table. In a real application,
 * user creation and invitation would be handled via Clerk’s server API.
 */
app.post('/api/admin/users', verifyAuth, requireAdmin, async (req, res) => {
  const { email, role, name } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: 'email and role are required' });
  }
  try {
    const { rows } = await pool.query('INSERT INTO users (email, role, name) VALUES ($1, $2, $3) RETURNING *', [email, role, name || null]);
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error creating user', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * Update the current user’s profile. Allows clients and readers to
 * modify their own name and email. The role cannot be changed via
 * this route.
 */
app.put('/api/users/me', verifyAuth, async (req, res) => {
  const userId = req.user.id;
  const { name, email } = req.body;
  try {
    await pool.query('UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3', [name, email, userId]);
    const { rows } = await pool.query('SELECT id, email, name, role FROM users WHERE id = $1', [userId]);
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error updating user profile', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Public API: list all registered readers.
 *
 * This endpoint returns a list of users with the role 'reader'. In a
 * production environment, this could be extended to include availability,
 * per‑minute rates, ratings, and profile pictures. No authentication is
 * required to view readers.
 */
app.get('/api/readers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE role = $1', ['reader']);
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching readers', err);
    return res.status(500).json({ error: 'Failed to fetch readers' });
  }
});

/**
 * Retrieve session history for the current user.
 * Clients see sessions where they were the client. Readers see sessions where they were the reader.
 */
app.get('/api/sessions', verifyAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    let query;
    let params;
    if (req.user.role === 'client') {
      query = 'SELECT * FROM sessions WHERE client_id = $1 ORDER BY start_time DESC';
      params = [userId];
    } else if (req.user.role === 'reader') {
      query = 'SELECT * FROM sessions WHERE reader_id = $1 ORDER BY start_time DESC';
      params = [userId];
    } else {
      query = 'SELECT * FROM sessions ORDER BY start_time DESC';
      params = [];
    }
    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching sessions', err);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * Basic dashboard metrics depending on user role.
 */
app.get('/api/dashboard', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (req.user.role === 'client') {
      const { rows: sessions } = await pool.query('SELECT * FROM sessions WHERE client_id = $1', [userId]);
      const totalSpent = sessions.reduce((sum, s) => sum + (s.amount_charged || 0), 0);
      return res.json({
        sessionsCount: sessions.length,
        totalSpent,
      });
    } else if (req.user.role === 'reader') {
      const { rows: sessions } = await pool.query('SELECT * FROM sessions WHERE reader_id = $1', [userId]);
      const totalEarned = sessions.reduce((sum, s) => sum + (s.amount_charged || 0) * 0.7, 0);
      return res.json({
        sessionsCount: sessions.length,
        totalEarned,
      });
    } else {
      const { rows: userRows } = await pool.query('SELECT count(*) AS count, role FROM users GROUP BY role');
      const { rows: sessionRows } = await pool.query('SELECT count(*) AS count FROM sessions');
      return res.json({
        userCounts: userRows,
        totalSessions: sessionRows[0].count,
      });
    }
  } catch (err) {
    console.error('Error fetching dashboard', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

/**
 * Messaging endpoints
 */
app.get('/api/messages/:contactId', verifyAuth, async (req, res) => {
  const userId = req.user.id;
  const contactId = parseInt(req.params.contactId, 10);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC',
      [userId, contactId],
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching messages', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', verifyAuth, async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, content } = req.body;
  if (!receiverId || !content) {
    return res.status(400).json({ error: 'receiverId and content are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
      [senderId, receiverId, content],
    );
    const message = rows[0];
    // Broadcast via Socket.io – use a deterministic room key based on user IDs
    const roomKey = [senderId, receiverId].sort().join('-');
    io.to(roomKey).emit('newMessage', message);
    return res.json(message);
  } catch (err) {
    console.error('Error creating message', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Forum endpoints
 */
app.get('/api/forum/topics', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT ft.*, u.name AS author_name FROM forum_topics ft JOIN users u ON ft.author_id = u.id ORDER BY ft.created_at DESC');
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching forum topics', err);
    return res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

app.post('/api/forum/topics', verifyAuth, async (req, res) => {
  const authorId = req.user.id;
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO forum_topics (author_id, title, content) VALUES ($1, $2, $3) RETURNING *',
      [authorId, title, content],
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error creating topic', err);
    return res.status(500).json({ error: 'Failed to create topic' });
  }
});

app.get('/api/forum/topics/:id/posts', async (req, res) => {
  const topicId = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query(
      'SELECT fp.*, u.name AS author_name FROM forum_posts fp JOIN users u ON fp.author_id = u.id WHERE topic_id = $1 ORDER BY fp.created_at ASC',
      [topicId],
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching posts', err);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/forum/topics/:id/posts', verifyAuth, async (req, res) => {
  const topicId = parseInt(req.params.id, 10);
  const authorId = req.user.id;
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO forum_posts (topic_id, author_id, content) VALUES ($1, $2, $3) RETURNING *',
      [topicId, authorId, content],
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error creating post', err);
    return res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * Marketplace endpoints
 */
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products');
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching products', err);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/orders', verifyAuth, async (req, res) => {
  const userId = req.user.id;
  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid productId or quantity' });
  }
  try {
    const { rows: prodRows } = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (prodRows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = prodRows[0];
    const totalPrice = parseFloat(product.price) * quantity;
    // Create order record
    const { rows: orderRows } = await pool.query(
      'INSERT INTO orders (user_id, product_id, quantity, total_price) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, productId, quantity, totalPrice],
    );
    // Create payment intent for the purchase
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `Order ${orderRows[0].id} for product ${product.name}`,
    });
    return res.json({ order: orderRows[0], clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error creating order', err);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * Streaming endpoints
 */
app.get('/api/streams', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT s.*, u.name AS reader_name FROM streams s JOIN users u ON s.reader_id = u.id WHERE s.status = $1 ORDER BY s.start_time DESC', ['active']);
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching streams', err);
    return res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

app.post('/api/streams/start', verifyAuth, async (req, res) => {
  if (req.user.role !== 'reader') {
    return res.status(403).json({ error: 'Only readers can start streams' });
  }
  const readerId = req.user.id;
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO streams (reader_id, title, description, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [readerId, title, description || '', 'active'],
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error starting stream', err);
    return res.status(500).json({ error: 'Failed to start stream' });
  }
});

app.post('/api/streams/:id/end', verifyAuth, async (req, res) => {
  const streamId = parseInt(req.params.id, 10);
  try {
    const { rows } = await pool.query('SELECT * FROM streams WHERE id = $1', [streamId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Stream not found' });
    const stream = rows[0];
    if (req.user.id !== stream.reader_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the stream owner or admin can end the stream' });
    }
    await pool.query('UPDATE streams SET status = $1, end_time = NOW() WHERE id = $2', ['ended', streamId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error ending stream', err);
    return res.status(500).json({ error: 'Failed to end stream' });
  }
});

app.get('/api/gifts', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM gifts');
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching gifts', err);
    return res.status(500).json({ error: 'Failed to fetch gifts' });
  }
});

app.post('/api/streams/:id/gifts', verifyAuth, async (req, res) => {
  const streamId = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const { giftId } = req.body;
  if (!giftId) {
    return res.status(400).json({ error: 'giftId is required' });
  }
  try {
    // Look up gift
    const { rows: giftRows } = await pool.query('SELECT * FROM gifts WHERE id = $1', [giftId]);
    if (giftRows.length === 0) return res.status(404).json({ error: 'Gift not found' });
    const gift = giftRows[0];
    // Create stream gift record
    await pool.query('INSERT INTO stream_gifts (stream_id, user_id, gift_id) VALUES ($1, $2, $3)', [streamId, userId, giftId]);
    // Create payment intent for gift
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(gift.value) * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `Gift ${gift.name} for stream ${streamId}`,
    });
    // Broadcast gift event to stream viewers
    const roomKey = `stream-${streamId}`;
    io.to(roomKey).emit('giftReceived', {
      streamId,
      userId,
      gift: { id: gift.id, name: gift.name, value: gift.value },
    });
    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error sending gift', err);
    return res.status(500).json({ error: 'Failed to send gift' });
  }
});

// Start the server
const PORT = process.env.PORT || 8001;
server.listen(PORT, () => {
  console.log(`SoulSeer backend listening on port ${PORT}`);
});