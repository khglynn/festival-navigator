# 🚀 Vercel Blob Backend Setup

## 🎉 What You Get

✅ **Real-time sync** - Changes appear for everyone within 10 seconds
✅ **Zero configuration** - Works automatically with your Vercel Blob
✅ **Automatic fallback** - Still works offline with localStorage
✅ **Simple sharing** - Just share the URL with your festival crew
✅ **Integrated billing** - Everything in one Vercel account

## 🛠️ Setup Steps

### 1. Connect Your Blob Store
1. In your Vercel project dashboard → **Storage** tab
2. Click **"Connect"** next to your `test-HG` Blob Store
3. Select your `festival-navigator` project
4. Click **"Connect Store"**

### 2. Deploy the Backend Version
Your code is already updated! Just push to GitHub:

```bash
git add .
git commit -m "Add Vercel Blob backend for real-time sync"
git push
```

Vercel will automatically deploy with the new backend features.

### 3. Test Real-Time Sync
1. Open your live app in two browser tabs
2. Select a person and click an artist in one tab
3. Watch it appear in the other tab within 10 seconds!

## 📊 How It Works

### Data Flow
1. **User clicks artist** → Saves to localStorage + Vercel Blob
2. **Every 10 seconds** → App polls Blob for updates
3. **Changes detected** → UI updates automatically
4. **Offline mode** → Falls back to localStorage

### File Structure
```
/api/selections.js    # Serverless function for data
/package.json         # Dependencies (@vercel/blob)
/index.html          # Frontend with Blob integration
```

## 💰 Cost Breakdown

**Vercel Blob Pricing:**
- **Storage**: $0.15/GB per month
- **Bandwidth**: $0.30/GB
- **Your usage**: ~$0.01/month (tiny JSON file)

**Estimated monthly cost**: **Less than $0.10** 🎉

## 🔧 Troubleshooting

### "Offline" Status
- Check that Blob store is connected to your project
- Verify deployment completed successfully
- Try refreshing the page

### "Error" Status
- Check Vercel function logs in dashboard
- Ensure `@vercel/blob` dependency is installed
- Verify environment variables are set

### Not Syncing Between Users
- Make sure everyone is using the same URL
- Check that Blob store has public read access
- Try the refresh button (circular arrow icon)

## 🆆 vs Supabase Comparison

| Feature | Vercel Blob | Supabase |
|---------|-------------|----------|
| **Setup** | ✅ 1-click | ⚠️ Separate account |
| **Real-time** | ⚠️ Polling (10s) | ✅ Instant |
| **Cost** | 💰 Pay per use | 🆓 Free tier |
| **Integration** | ✅ Perfect | ⚠️ External |
| **Complexity** | ✅ Simple | ⚠️ More features |

**For your festival app**: Vercel Blob is perfect! Simple, integrated, and costs almost nothing.

## 🔄 Sync Frequency

The app polls for updates every **10 seconds**. This means:
- Changes appear quickly but not instantly
- Very low server costs
- Good balance of real-time feel vs efficiency

To change sync frequency, edit this line in `index.html`:
```javascript
// Poll every 10 seconds (10000ms)
syncInterval = setInterval(async () => {
    if (isOnlineMode) {
        await loadSelectionsFromBlob();
    }
}, 10000); // ← Change this number
```

## 🔒 Security

This setup uses **public access** for simplicity:
- Anyone with the URL can view/edit selections
- Perfect for trusted friend groups
- No login required

For production apps, you'd add:
- User authentication
- Access controls
- Rate limiting

## 🎆 Next Steps

1. **Share the URL** with your festival crew
2. **Test together** - have everyone add their picks
3. **Use the tools** - try the conflict resolver and export features
4. **Download schedules** as images for offline reference

---

**Questions?** The app works great! Just share your Vercel URL and start planning your perfect Lollapalooza experience! 🎵