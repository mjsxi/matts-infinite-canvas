# Server-Side Authentication Deployment Guide

This guide will help you deploy your infinite canvas application with server-side authentication to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **Node.js**: Install Node.js 18+ 
3. **Supabase Project**: You already have one set up

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Database Schema

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the SQL commands from `database/schema.sql`

This will create:
- `users` table for user authentication
- Proper foreign key constraints
- Row Level Security policies

## Step 3: Configure Environment Variables

### In Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add these variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://ruefemuqeehlqieitoma.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_here
```

### Get your Supabase Service Key:
1. Go to Supabase Dashboard > Settings > API
2. Copy the "service_role" key (NOT the anon key)
3. This key has admin privileges for server-side operations

### Generate JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Deploy to Vercel

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

## Step 5: Test Authentication

Once deployed:

1. Visit your deployed site
2. Click the "Login" button
3. Switch to "Register" tab
4. Create a test account
5. Login with your new account

## Features

### User Features
- **Registration**: Create new accounts with username/password
- **Login/Logout**: Secure session management
- **JWT Tokens**: HTTP-only cookies for security
- **Role-based Access**: User/Admin roles

### Admin Features
- First user can be made admin in Supabase dashboard
- Full canvas editing capabilities
- User management (future enhancement)

## Security Features

- **JWT Tokens**: Secure, stateless authentication
- **HTTP-Only Cookies**: Prevent XSS attacks
- **Password Hashing**: bcrypt with salt rounds
- **CORS Configuration**: Proper cross-origin setup
- **Row Level Security**: Database-level permissions

## Database Structure

### Users Table
```sql
- id: UUID primary key
- username: Unique username
- password_hash: bcrypt hashed password
- email: Optional email
- role: 'user' or 'admin'
- created_at: Timestamp
- updated_at: Timestamp
```

### Canvas Items Table
- Now properly linked to users via foreign key
- Maintains all existing functionality
- Users own their created items

## API Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration  
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify authentication status

## Legacy Compatibility

The app maintains backward compatibility:
- Legacy admin password still works
- Gradual migration to server-side auth
- Both systems can coexist

## Environment Variables Reference

```bash
# Required for production
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key  
JWT_SECRET=your_jwt_secret_key

# Optional (defaults from main.js)
ADMIN_PASSWORD=canvas123
```

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