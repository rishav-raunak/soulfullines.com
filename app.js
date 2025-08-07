const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Upload config
const upload = multer({ dest: 'uploads/' });

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');

// ───────────── ROUTES ─────────────

// Serve main.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

// Auth Page
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// Register
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', [name, email, hash, 'user']);
  res.redirect('/auth');
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.redirect(user.role === 'admin' ? '/admin-dashboard' : '/user-dashboard');
  } else {
    res.send('Invalid credentials');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Dashboard Routes
app.get('/user-dashboard', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') return res.redirect('/');
  const posts = await pool.query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [req.session.user.id]);
  res.render('user-dashboard', { user: req.session.user, posts: posts.rows });
});

app.get('/admin-dashboard', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  const users = await pool.query('SELECT id, name, email, role FROM users');
  const postCounts = await pool.query('SELECT user_id, COUNT(*) FROM posts GROUP BY user_id');
  res.render('admin-dashboard', { admin: req.session.user, users: users.rows, counts: postCounts.rows });
});

// Add Post
app.post('/add-post', upload.single('image'), async (req, res) => {
  const { tag, type, content } = req.body;
  const user = req.session.user;
  if (!user) return res.sendStatus(401);

  let finalContent = type === 'image' ? req.file.filename : content;
  await pool.query('INSERT INTO posts (user_id, tag, type, content) VALUES ($1, $2, $3, $4)', [user.id, tag, type, finalContent]);
  res.redirect('/user-dashboard');
});

// Delete Post
app.post('/delete-post/:id', async (req, res) => {
  const postId = req.params.id;
  const user = req.session.user;
  await pool.query('DELETE FROM posts WHERE id = $1 AND user_id = $2', [postId, user.id]);
  res.redirect('/user-dashboard');
});

// Show all posts (for main.html)
app.get('/all-posts', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
  res.json(result.rows);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
