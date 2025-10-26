# Supabase Integration Setup Guide

This guide will walk you through setting up Supabase with PostgreSQL for the Heyday Mobile app.

## Overview

The Heyday app uses Supabase for:
- **Authentication**: User sign up, login, and session management
- **Database**: PostgreSQL database for storing user profiles, plants, and friendships
- **Storage**: Image storage for plant photos (using Supabase Storage or AWS S3)

## Database Schema

The app uses the following tables:

### 1. **profiles** - User profiles
- `id` (UUID, references auth.users)
- `username` (TEXT, unique)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### 2. **plants** - Plant entries
- `id` (UUID, primary key)
- `user_id` (UUID, references profiles)
- `species` (TEXT) - Plant species name
- `nickname` (TEXT, optional) - Friendly name for the plant
- `age` (TEXT) - Plant age
- `watering_schedule` (FLOAT) - Number of waters per day (e.g., 1.0, 0.5, 2.0)
- `notes` (TEXT, optional) - Care notes and observations
- `image_url` (TEXT, optional) - URL to plant photo in storage
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### 3. **friendships** - Friend connections
- `id` (UUID, primary key)
- `user_id` (UUID, references profiles)
- `friend_id` (UUID, references profiles)
- `status` (TEXT) - 'pending', 'accepted', or 'rejected'
- `created_at` (TIMESTAMP)

## Step-by-Step Setup

### Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in the project details:
   - **Name**: Heyday Mobile (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the region closest to your users
5. Click "Create new project" and wait for it to be set up (~2 minutes)

### Step 2: Set Up the Database Schema

1. In your Supabase project dashboard, click on the **SQL Editor** icon in the left sidebar
2. Click "New query"
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste it into the SQL Editor
5. Click "Run" to execute the schema

This will create:
- All necessary tables (profiles, plants, friendships)
- Row Level Security (RLS) policies for data protection
- Indexes for better performance
- Triggers for automatic timestamp updates

### Step 3: Configure Supabase Storage (for Plant Images)

#### Option A: Use Supabase Storage (Recommended)

1. In your Supabase dashboard, go to **Storage** in the left sidebar
2. Click "Create a new bucket"
3. Name it: `plant-images`
4. Set it to **Public bucket** (so images are publicly accessible)
5. Click "Create bucket"

#### Option B: Use AWS S3 (Alternative)

If you prefer AWS S3:
1. Create an S3 bucket in AWS
2. Configure CORS and public access as needed
3. Get your AWS credentials (Access Key ID and Secret Access Key)
4. Update the image upload function in `app/addplant.tsx` to use AWS SDK

### Step 4: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** (gear icon)
2. Click on **API** in the left sidebar
3. You'll see:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (a long JWT token)
4. Copy both of these values

### Step 5: Configure Environment Variables

1. Create a `.env` file in the root of your HeydayMobile project:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **IMPORTANT**: Add `.env` to your `.gitignore` to keep your credentials secure:
   ```bash
   echo ".env" >> .gitignore
   ```

### Step 6: Enable Email Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Configure email settings:
   - You can use Supabase's built-in email service for development
   - For production, configure your own SMTP server

### Step 7: Test the Integration

1. Start your Expo development server:
   ```bash
   npm start
   ```

2. Test the authentication flow:
   - Open the app
   - Click "Create Account"
   - Sign up with an email and password
   - Try logging in
   - Navigate to "Add Plant" and create a plant entry

3. Verify in Supabase dashboard:
   - Go to **Authentication** → **Users** to see registered users
   - Go to **Table Editor** → **plants** to see created plant entries

## Data Structure Reference

### Plant Entry Example
```typescript
{
  id: "uuid-here",
  user_id: "user-uuid",
  species: "Monstera deliciosa",
  nickname: "Monty",
  age: "2 years",
  watering_schedule: 1.5,  // 1.5 times per day
  notes: "Prefers indirect sunlight. Rotate weekly.",
  image_url: "https://your-project.supabase.co/storage/v1/object/public/plant-images/123.jpg",
  created_at: "2025-01-15T10:30:00Z",
  updated_at: "2025-01-15T10:30:00Z"
}
```

### Friendship Example
```typescript
{
  id: "uuid-here",
  user_id: "user-1-uuid",
  friend_id: "user-2-uuid",
  status: "accepted",
  created_at: "2025-01-15T10:30:00Z"
}
```

## Security Notes

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only view/edit their own data
- Users can only see plants they created
- Users can manage their own friendships

### Best Practices

1. **Never commit `.env` file** - Keep your API keys secure
2. **Use environment variables** - Don't hardcode credentials
3. **Enable MFA** - Add multi-factor authentication in production
4. **Monitor usage** - Check Supabase dashboard for unusual activity
5. **Regular backups** - Enable automatic backups in Supabase settings

## Troubleshooting

### "Invalid API key" error
- Double-check your `.env` file has the correct values
- Make sure you're using the **anon/public** key, not the service role key
- Restart the Expo dev server after changing `.env`

### "Row violates row-level security policy"
- Check that the user is authenticated before making database calls
- Verify RLS policies are set up correctly (run the schema SQL again)

### Image upload fails
- Verify the `plant-images` storage bucket exists
- Make sure the bucket is set to public
- Check storage permissions in Supabase dashboard

### User can't sign up
- Check email authentication is enabled in Supabase
- Verify email domain is not restricted
- Check Supabase logs for specific error messages

## Next Steps

Now that Supabase is integrated:

1. **Implement plant listing** - Show user's plants on dashboard
2. **Add friends feature** - Implement friend requests and management
3. **Plant sharing** - Allow users to share plants with friends
4. **Watering reminders** - Use watering_schedule to send notifications
5. **Plant analytics** - Track plant growth and care history

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Authentication](https://supabase.com/docs/guides/auth)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
