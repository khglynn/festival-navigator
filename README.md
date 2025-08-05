# 🎪 Festival Navigator - Lollapalooza 2025

A vibrant, interactive web app for planning your perfect Lollapalooza 2025 experience with friends and family!

## ✨ Features

### 🎯 Core Functionality
- **Multi-Person Tracking**: Track preferences for up to 6 people with color-coded selections
- **Interactive Schedule Grid**: Visual timeline showing all artists across multiple stages
- **Smart Conflict Resolution**: AI-powered suggestions to optimize your group's festival experience
- **Priority Levels**: Mark artists as "Must See", "Nice to See", or "Highlight"

### 🛠️ Festival Tools
- **Download Schedule**: Export your daily schedule as a PNG image
- **Group Plan Optimizer**: Find time conflicts and get AI-suggested compromises
- **Export All Likes**: Generate a copy-paste list of everyone's selections
- **Bulk Update**: Quickly add or update multiple artist selections at once

## 🚀 Live Demo

Visit the live app: [Coming soon after Vercel deployment]

## 💻 Technologies Used

- **HTML5** - Structure and content
- **Tailwind CSS** - Styling via CDN
- **Vanilla JavaScript** - Interactive functionality
- **html2canvas** - Schedule image export
- **Google Gemini API** - AI-powered features (optional)
- **Local Storage** - Persistent data storage

## 🎨 Color Coding

Each person gets their own unique color:
- **Kevin**: Red
- **Molly**: Blue
- **Megan**: Green
- **Ross**: Yellow
- **Other Fam**: Purple
- **Other Peeps**: Pink

## 📱 How to Use

1. **Select a Person**: Click on a person's name to activate their selection mode
2. **Choose a Day**: Navigate between Thursday, Friday, Saturday, and Sunday
3. **Click Artists**: 
   - First click: Nice to See (50% opacity)
   - Second click: Must See (100% opacity)
   - Third click: Highlight (dashed border)
   - Fourth click: Remove selection
4. **Use Festival Tools**: Access AI features, download schedules, and manage selections

## 🔑 API Key Setup (Optional)

For AI-powered features, you'll need a Google Gemini API key:
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Generate a free API key
3. Enter it when prompted in the app
4. The key is stored locally in your browser

## 🏗️ Local Development

```bash
# Clone the repository
git clone https://github.com/khglynn/festival-navigator.git

# Navigate to the project
cd festival-navigator

# Open in browser
open index.html
# Or use a local server
python -m http.server 8000
```

## 📦 Deployment

This project is configured for easy deployment on Vercel:

1. Fork or clone this repository
2. Connect your GitHub account to Vercel
3. Import the project
4. Deploy with zero configuration needed

## 🎵 Festival Data

The app includes the complete Lollapalooza 2025 lineup with:
- 4 days of performances
- 10+ stages
- 200+ artists
- Accurate time slots and stage assignments

## 📄 License

MIT License - Feel free to use and modify for your own festival planning needs!

## 🙏 Acknowledgments

- Lollapalooza for the amazing festival
- Google for the Gemini API
- The festival crew for making memories together

---

Made with ❤️ for festival lovers