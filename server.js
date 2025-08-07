require('dotenv').config();


const express = require('express');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const PORT = 3000;

// PostgreSQL pool setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});


// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'your-secret',
  resave: false,
  saveUninitialized: true,
}));

app.set('view engine', 'ejs');

// Storage for image uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Routes

// === Home ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Auth Page ===
app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// === Register User ===
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  await pool.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', [name, email, hashed, 'user']);
  res.redirect('/auth');
});

// === Login ===
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);

  if (result.rows.length === 0) return res.send('No user found');

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.send('Wrong password');

  req.session.user = user;

  if (user.role === 'admin') {
    res.redirect('/admin');
  } else {
    res.redirect('/dashboard');
  }
});

// === User Dashboard ===
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/auth');
  res.render('user-dashboard', { user: req.session.user });
});

// === Admin Dashboard ===
// === Admin Dashboard ===
app.get('/admin', async (req, res) => {
  // Pehle check karein ki user logged in hai aur admin hai ya nahi
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/auth');
  }

  try {
    // Correct Query: Sabhi users ka data aur unke posts ka count laayein
    const usersQuery = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.bio, 
        u.is_blocked, 
        u.master,
        COUNT(p.id) AS "postCount"
      FROM 
        users u
      LEFT JOIN 
        posts p ON u.id = p.user_id
      GROUP BY 
        u.id
      ORDER BY 
        u.id;
    `;
    
    const usersResult = await pool.query(usersQuery);

    // EJS template ko sahi data pass karein
    // 'user' ki jagah 'admin' key ka istemal karein
    res.render('admin-dashboard', { 
      admin: req.session.user, // Current admin ka data
      users: usersResult.rows  // Sabhi users ki list post count ke saath
    });

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.send('Admin dashboard load karne mein error aaya.');
  }
});
// === Add Post ===
app.post('/add-post', upload.single('image'), async (req, res) => {
  const { tag, type, content } = req.body;
  const actualContent = type === 'image' ? req.file.filename : content;
  const userId = req.session.user.id;

  await pool.query('INSERT INTO posts (user_id, tag, type, content) VALUES ($1, $2, $3, $4)', [userId, tag, type, actualContent]);
  res.redirect('/dashboard');
});

// === All Posts for Main Page ===
// app.get('/all-posts', async (req, res) => {
//   const result = await pool.query('SELECT * FROM posts ORDER BY id DESC');
//   res.json(result.rows);
// });

// === Logout ===
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


app.use('/uploads', express.static('uploads'));



// GET ROUTE: PAGINATION KE SAATH SABHI POSTS FETCH KARNE KE LIYE
app.get('/all-posts', async (req, res) => {
    // Frontend se 'page' aur 'limit' lein, ya default values use karein
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    
    // Database se data skip karne ke liye OFFSET calculate karein
    const offset = (page - 1) * limit;

    try {
        // Query 1: Current page ke liye posts fetch karein
        const postsQuery = 'SELECT * FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2';
        const postsResult = await pool.query(postsQuery, [limit, offset]);
        
        // Query 2: Total posts ka count nikalein
        const totalPostsQuery = 'SELECT COUNT(*) FROM posts';
        const totalPostsResult = await pool.query(totalPostsQuery);
        const totalPosts = parseInt(totalPostsResult.rows[0].count);

        // Total pages calculate karein
        const totalPages = Math.ceil(totalPosts / limit);

        // Frontend ko zaroori data ke saath response bhejein
        res.json({
            posts: postsResult.rows,
            currentPage: page,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        });

    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ message: 'Server par posts fetch karte waqt error aaya.' });
    }
});

// DELETE ROUTE: ID KE BASIS PAR POST DELETE KARNE KE LIYE
app.delete('/delete-post/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Step 1: Post ko database se fetch karein taaki file ka naam mil sake (agar image hai)
        const findPostQuery = 'SELECT type, content FROM posts WHERE id = $1';
        const postResult = await pool.query(findPostQuery, [id]);

        if (postResult.rows.length === 0) {
            return res.status(404).json({ message: 'Post nahi mila.' });
        }

        const post = postResult.rows[0];

        // Step 2: Agar post type 'image' hai, to server se image file delete karein
        if (post.type === 'image') {
            const imagePath = path.join(__dirname, 'uploads', post.content);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath); // File ko delete karein
                console.log(`Deleted image: ${imagePath}`);
            }
        }

        // Step 3: Post ko database se delete karein
        const deleteQuery = 'DELETE FROM posts WHERE id = $1';
        await pool.query(deleteQuery, [id]);

        res.status(200).json({ message: 'Post successfully delete ho gaya.' });

    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ message: 'Server par post delete karte waqt error aaya.' });
    }
});






// 1. About Us page ke liye route
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// 2. Privacy Policy page ke liye route
app.get('/privacy-policy', (req, res) => {

    res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

// 3. Disclaimer page ke liye route
app.get('/disclaimer', (req, res) => { 
    res.sendFile(path.join(__dirname, 'public', 'disclaimer.html'));
});

// 4. Terms and Conditions page ke liye route
app.get('/terms-and-conditions', (req, res) => {
    
    res.sendFile(path.join(__dirname, 'public', 'Terms-and-Conditions.html'));
});


// GET request: Jab koi /contact-us URL par jaayega, to use form dikhega
app.get('/contact-us', (req, res) => {
    // Apne 'contact-us.html' file ka sahi path yahan dein
    res.sendFile(path.join(__dirname, 'public', 'contact-us.html'));
});

// POST request: Jab koi contact form submit karega
app.post('/contact-submit', (req, res) => {
    const formData = req.body;
    console.log('Contact form se data mila:', formData);
    // Yahan data database mein save karne ka logic aayega
    res.send('Thank you for contacting us!');
});



app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
