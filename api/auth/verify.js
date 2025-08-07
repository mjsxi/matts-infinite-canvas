// Vercel serverless function to verify authentication status
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.cookies['auth-token'];

    if (!token) {
      return res.status(401).json({ authenticated: false });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    return res.status(200).json({
      authenticated: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        isAdmin: decoded.isAdmin
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ authenticated: false });
  }
}