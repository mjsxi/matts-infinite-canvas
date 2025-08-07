// Vercel serverless function for admin logout
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear authentication cookies
  res.setHeader('Set-Cookie', [
    'admin-token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
    'admin-role=; Secure; SameSite=Strict; Path=/; Max-Age=0'
  ]);

  return res.status(200).json({ 
    success: true, 
    message: 'Admin logged out successfully' 
  });
}