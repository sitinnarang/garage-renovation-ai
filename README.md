# GarageAI - AI-Powered Garage Renovation

Transform your garage with AI-powered design visualization, cost estimates, and renovation suggestions.

![GarageAI](https://img.shields.io/badge/AI-Powered-blue) ![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![OpenAI](https://img.shields.io/badge/OpenAI-DALL--E%203-orange)

## Features

- **🎨 Design Mockups** - AI transforms your garage photos into stunning renovation visualizations
- **💰 Cost Estimates** - Get instant AI-powered cost breakdowns based on your preferences
- **💡 Smart Suggestions** - Receive personalized renovation recommendations
- **📸 Before/After Views** - Interactive comparison slider to see the transformation

## Tech Stack

- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: Node.js + Express
- AI: OpenAI GPT-4 Vision + DALL-E 3

## Quick Start

### 1. Clone and Install

```bash
cd garage-renovation-ai
npm install
```

### 2. Configure Environment

```bash
# Copy the example env file
copy .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here
```

### 3. Run the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### 4. Open in Browser

Visit `http://localhost:3000`

## API Endpoints

### POST /api/generate

Generate AI renovation design and estimates.

**Request Body:**
```json
{
  "image": "base64-encoded-image",
  "style": "modern|industrial|workshop|gym|office|storage",
  "budget": "low|medium|high|premium",
  "priority": "aesthetics|functionality|storage|durability"
}
```

**Response:**
```json
{
  "success": true,
  "generatedImage": "url-to-generated-image",
  "estimate": {
    "total": 12500,
    "breakdown": [
      { "name": "Flooring", "cost": 3000 },
      { "name": "Lighting", "cost": 1500 }
    ]
  },
  "suggestions": [
    "Install LED shop lights",
    "Add rubber flooring"
  ]
}
```

### GET /api/health

Health check endpoint.

## Renovation Styles

| Style | Description |
|-------|-------------|
| Modern | Clean, minimalist design with neutral colors |
| Industrial | Raw materials, metal accents, urban style |
| Workshop | Functional workspace with tool storage |
| Gym | Fitness area with rubber flooring |
| Office | Quiet workspace with insulation |
| Storage | Maximized storage with organization |

## Budget Ranges

- **Low**: $1,000 - $5,000
- **Medium**: $5,000 - $15,000
- **High**: $15,000 - $30,000
- **Premium**: $30,000+

## Demo Mode

The app works in demo mode without an OpenAI API key, providing sample estimates and suggestions.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes (for AI features) |
| `PORT` | Server port (default: 3000) | No |

## Project Structure

```
garage-renovation-ai/
├── index.html      # Main HTML page
├── styles.css      # Styles
├── script.js       # Frontend JavaScript
├── server.js       # Node.js backend
├── package.json    # Dependencies
├── .env.example    # Environment template
└── README.md       # This file
```

## Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new secret key
5. Copy and add to your `.env` file

**Note:** DALL-E 3 image generation requires a paid OpenAI account with sufficient credits.

## License

MIT License - feel free to use for personal or commercial projects.

---

Built with ❤️ using AI
