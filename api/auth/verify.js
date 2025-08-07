// Vercel serverless function to verify admin authentication
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.cookies['admin-token'];

    if (!token) {
      return res.status(200).json({ authenticated: false });
    }

    if (!JWT_SECRET) {
      console.error('Missing JWT_SECRET environment variable');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role === 'admin') {
      return res.status(200).json({
        authenticated: true,
        isAdmin: true,
        role: 'admin'
      });
    } else {
      return res.status(200).json({ authenticated: false });
    }

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(200).json({ authenticated: false });
    }
    
    console.error('Token verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}