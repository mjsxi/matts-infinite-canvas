# Secure Single Admin Authentication Deployment Guide

This guide will help you deploy your infinite canvas application with secure server-side admin authentication to Vercel.

🔐 **SECURE ADMIN ACCESS**: Password stored securely on server, verified server-side, with JWT tokens and HTTP-only cookies.

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **Node.js**: For running the password generator script
3. **Your existing canvas**: Already working with Supabase

## Step 1: Generate Secure Password Hash

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Generate your password hash**:
   ```bash
   node generate-password-hash.js
   ```

3. **Copy the output** - you'll need the `ADMIN_PASSWORD_HASH` and `JWT_SECRET` values

4. **Delete the generator script** (for security):
   ```bash
   rm generate-password-hash.js
   ```

## Step 2: Configure Vercel Environment Variables

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add these two variables:

   ```bash
   ADMIN_PASSWORD_HASH = [paste the hash from step 1]
   JWT_SECRET = [paste the JWT secret from step 1]
   ```

## Step 3: Deploy to Vercel

### Option A: Via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option B: Via GitHub Integration
1. Push your code to GitHub
2. Connect repository in Vercel dashboard
3. Deploy automatically

## Step 4: Test Authentication

Once deployed:

1. Visit your deployed site at `yoursite.vercel.app` (appears as guest-only canvas)
2. **Secret Access**: Go directly to `yoursite.vercel.app/admin.html`
3. **Enter admin password**: The password you used in the generator (default: `canvas123`)
4. **Login successful**: Redirects to canvas with full admin tools

### 🔐 **How It Works:**
- **Public users**: See a read-only canvas with just a center button
- **Secret admin**: Knows to visit `/admin.html` and enter password
- **Server verification**: Password verified server-side against secure hash
- **JWT tokens**: Secure authentication with HTTP-only cookies
- **24-hour sessions**: Auto-expires for security
- **Clean interface**: No hints or visible login options

## Features

### Secure Single Admin System
- **Server-side password verification**: Password never sent to client
- **Secure password storage**: bcrypt hashed password in Vercel environment
- **JWT authentication**: Secure tokens with HTTP-only cookies
- **24-hour auto-expire**: Sessions automatically expire for security
- **Secret access**: No visible login interface
- **Full admin tools**: Add images, text, drawing, center point, clear all

## Security Features

- **Password hashing**: bcrypt with salt for secure password storage
- **JWT tokens**: Cryptographically signed authentication tokens
- **HTTP-only cookies**: Prevents XSS attacks on authentication data
- **Server-side verification**: All authentication logic runs on secure server
- **Hidden authentication**: No public login interface hints
- **Automatic expiration**: 24-hour session timeout
- **Environment variables**: Sensitive data stored in secure Vercel environment

## Deployment Benefits

- **No database changes needed**: Uses your existing Supabase setup
- **Serverless functions**: Scales automatically with Vercel
- **Production-ready security**: Industry-standard authentication practices
- **Easy password changes**: Update environment variable to change password
- **Maintains existing data**: All your canvas items remain unchanged

## Troubleshooting

### Common Issues:

1. **API Routes Not Working**
   - Check Vercel function logs
   - Verify environment variables
   - Ensure Node.js runtime is 18+

2. **Database Connection Errors**
   - Verify Supabase service key
   - Check database schema is applied
   - Confirm RLS policies

3. **Authentication Not Persisting**
   - Check cookie settings
   - Verify JWT secret is set
   - Ensure HTTPS in production

### Debug Steps:
1. Check Vercel function logs
2. Test API endpoints directly
3. Verify environment variables
4. Check browser developer tools

## Next Steps

1. **User Management**: Add admin panel for user management
2. **Password Reset**: Implement forgot password flow
3. **Email Verification**: Add email verification process
4. **Rate Limiting**: Add authentication rate limiting
5. **Audit Logging**: Track user actions

## Support

If you encounter issues:
1. Check Vercel logs
2. Verify all environment variables
3. Test API endpoints individually
4. Review browser console for errors