# 🚀 Backend Setup Guide

## Quick Start (5 minutes)

### Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Click **"Start your project"** → Sign in with GitHub
3. Click **"New Project"**
4. Fill in:
   - **Name**: `festival-navigator`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to you
5. Click **"Create new project"** (wait 2-3 minutes)

### Step 2: Create Database Table
1. In Supabase dashboard → **Table Editor**
2. Click **"Create a new table"**
3. Table name: `artist_selections`
4. Add columns:

```sql
id (int8, primary key, auto-increment) ✓
artist_name (text, not null)
person_name (text, not null) 
selection_level (int2, not null)
created_at (timestamptz, default now())
updated_at (timestamptz, default now())
```

5. Click **"Save"**

### Step 3: Enable Public Access
1. Go to **Authentication** → **Policies**
2. For `artist_selections` table:
   - Click **"New Policy"** → **"Enable read access for all users"**
   - Click **"New Policy"** → **"Enable insert/update for all users"**

### Step 4: Get Your API Keys
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

### Step 5: Deploy Backend Version
1. Replace your `index.html` with `index-backend.html`
2. Push to GitHub:
```bash
cp index-backend.html index.html
git add .
git commit -m "Add backend support with Supabase"
git push
```

3. Your Vercel deployment will auto-update!

### Step 6: Configure Your App
1. Visit your live app
2. Enter your Supabase URL and API key when prompted
3. Start adding selections - they'll sync in real-time!

## 🎉 What You Get

✅ **Real-time sync** - Everyone sees changes instantly
✅ **Cross-device access** - Same data on phone, laptop, tablet
✅ **Group collaboration** - Share one URL with your crew
✅ **Automatic backup** - Data stored safely in the cloud
✅ **Offline fallback** - Still works without internet

## 🔧 Alternative: Vercel Database

If you prefer using Vercel's database:

1. In your Vercel dashboard → **Storage** → **Create Database**
2. Choose **Vercel Postgres**
3. Create the same table structure
4. Use Vercel's connection details instead of Supabase

## 🆘 Troubleshooting

**"Connection failed"**
- Double-check your URL and API key
- Make sure table policies are enabled

**"Not syncing"**
- Check the sync status indicator (top-right)
- Try refreshing the page

**"Can't see others' selections"**
- Make sure everyone is using the same URL
- Check that RLS policies allow public access

## 💰 Cost

**Supabase Free Tier:**
- 500MB database
- 2GB bandwidth/month
- 50,000 monthly active users
- Perfect for festival planning!

**Vercel Database:**
- $20/month for Postgres
- Higher performance
- Integrated with your hosting

## 🔒 Security Note

This setup uses public access for simplicity. For production apps, you'd want:
- User authentication
- Row-level security
- API rate limiting

But for festival planning with friends, public access is fine!

---

**Need help?** The app works great without a backend too - just use the original version for personal planning!