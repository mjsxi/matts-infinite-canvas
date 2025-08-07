// Vercel serverless function for user logout
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear authentication cookies
  res.setHeader('Set-Cookie', [
    'auth-token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
    'user-role=; Secure; SameSite=Strict; Path=/; Max-Age=0'
  ]);

  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}