const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { query } = require('../config/database');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        error: 'Please provide a valid email address' 
      });
    }

    // For demo purposes, create a demo user if they don't exist
    let user;
    const userQuery = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (userQuery.rows.length === 0) {
      // Create demo user on the fly
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = await query(
        'INSERT INTO users (email, password_hash, name, is_active) VALUES ($1, $2, $3, $4) RETURNING id, email, name, is_active, created_at',
        [email.toLowerCase(), hashedPassword, 'Demo User', true]
      );
      user = createUserQuery.rows[0];
      console.log(`📝 Created demo user: ${email}`);
    } else {
      user = userQuery.rows[0];
      
      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'Invalid email or password' 
        });
      }
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ 
        error: 'Account is deactivated. Please contact administrator.' 
      });
    }

    // Update last login
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Return user data and token
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during login' 
    });
  }
});

// Get current user (protected route)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userQuery = await query(
      'SELECT id, email, name, is_active, created_at, last_login FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    const user = userQuery.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ 
        error: 'Account is deactivated' 
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Logout endpoint (optional - mainly clears server-side sessions if needed)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a JWT system, logout is mainly handled client-side by removing the token
    // But we can log the logout event
    console.log(`📤 User logged out: ${req.user.email}`);
    
    res.json({ 
      message: 'Logout successful' 
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ 
      error: 'Internal server error during logout' 
    });
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token is required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('🔒 Token verification failed:', err.message);
      return res.status(403).json({ 
        error: 'Invalid or expired token' 
      });
    }
    
    req.user = user;
    next();
  });
}

module.exports = router;