// Vercel serverless function for secure admin login
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (!ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    console.error('Missing environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Verify password against stored hash
    const isValidPassword = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Create JWT token for admin
    const token = jwt.sign(
      { 
        role: 'admin',
        isAdmin: true,
        loginTime: new Date().toISOString()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.setHeader('Set-Cookie', [
      `admin-token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
      `admin-role=admin; Secure; SameSite=Strict; Path=/; Max-Age=86400`
    ]);

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      isAdmin: true
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}