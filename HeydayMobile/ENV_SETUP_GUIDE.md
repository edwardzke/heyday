# 🔐 Environment Variables Setup Guide

## Quick Start (3 Steps)

### Step 1: Get Your Supabase Keys

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project (or create one if you haven't)
3. Click the **Settings** icon (⚙️) in the left sidebar
4. Click **API** in the settings menu
5. You'll see two important values:

   **Project URL** (looks like):
   ```
   https://abcdefghijklmnop.supabase.co
   ```

   **anon public key** (long JWT token starting with `eyJ...`):
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 2: Add Keys to Your .env File

1. Open the `.env` file in your HeydayMobile folder (I just created it for you!)
2. Replace the placeholder text with your actual keys:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ACTUAL_KEY_HERE
   ```

3. **Save the file**

### Step 3: Restart Your Dev Server

**IMPORTANT**: Expo only loads environment variables on startup!

```bash
# Stop your current dev server (Ctrl+C)
# Then restart:
npm start
```

## ✅ How It Works

Your code in `lib/supabase.ts` already reads these variables:

```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
```

### Why the `EXPO_PUBLIC_` Prefix?

In Expo/React Native:
- ✅ Variables starting with `EXPO_PUBLIC_` are accessible in your app
- ❌ Variables without this prefix won't work
- ✅ They're called at **build time**, not runtime

## 🔒 Security Notes

### What's Safe:

1. **The anon/public key IS safe to expose in your app**
   - It's meant to be public
   - It's protected by Row Level Security (RLS) policies
   - Users can only access data you allow via RLS

2. **The .env file is in .gitignore**
   - I already added it for you
   - It won't be committed to git
   - Each developer needs their own .env file

### What's NOT Safe (Don't Use!):

1. ❌ **service_role key** - NEVER use this in the app (it bypasses RLS)
2. ❌ **Database password** - Never put this in the app

## 🧪 Testing It Works

After restarting the dev server, try signing up:

1. Open your app
2. Click "Create Account"
3. Fill in the signup form
4. If you get the error about missing keys, restart the dev server again

## 🚨 Troubleshooting

### "Missing EXPO_PUBLIC_SUPABASE_URL" error:

1. Check `.env` file exists in HeydayMobile root folder
2. Check the variable names are EXACTLY: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. **Restart the dev server** (Expo doesn't hot-reload .env changes)
4. Make sure there are no quotes around the values:
   ```bash
   # ✅ Correct:
   EXPO_PUBLIC_SUPABASE_URL=https://abc.supabase.co

   # ❌ Wrong:
   EXPO_PUBLIC_SUPABASE_URL="https://abc.supabase.co"
   ```

### Keys still not loading:

```bash
# Clear Expo cache and restart:
npx expo start --clear
```

### Can't find .env file:

```bash
# Create it:
touch .env

# Then edit with your keys
```

## 📁 File Structure

```
HeydayMobile/
├── .env              ← Your actual keys (gitignored, not committed)
├── .env.example      ← Template with no real keys (safe to commit)
├── .gitignore        ← Contains .env so it's not committed
└── lib/
    └── supabase.ts   ← Reads from process.env
```

## 🎯 Quick Reference

```bash
# Get your keys:
https://app.supabase.com → Your Project → Settings → API

# Edit your .env:
code .env
# or
nano .env

# Restart dev server:
npm start
```

## ✨ That's It!

Once you've:
1. ✅ Added your keys to `.env`
2. ✅ Restarted the dev server
3. ✅ Your app will connect to Supabase!

The `.env` file is already in `.gitignore`, so your keys are safe and won't be committed to git.
