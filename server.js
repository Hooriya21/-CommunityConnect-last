const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Sample exchanges data
let exchanges = [
    { id: 1, userId: 101, type: 'offer', skill: 'Gardening', description: 'Help with flowers', location: 'Main St', points: 20 },
    { id: 2, userId: 102, type: 'need', skill: 'Cooking', description: 'Learn pasta', location: 'Oak Ave', points: 15 }
];

// API Routes
app.get('/api/match/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userExchanges = exchanges.filter(e => e.userId === userId);

    if (userExchanges.length === 0) return res.json([]);

    const matches = exchanges.filter(e =>
        e.userId !== userId &&
        e.type !== userExchanges[0].type
    ).slice(0, 3);

    res.json(matches);
});

// AI Skill Analysis Route
app.post('/api/analyze-skill', async (req, res) => {
    const skillText = req.body.text;
    console.log("=".repeat(50));
    console.log("🔍 ANALYZING SKILL:", skillText);
    console.log("=".repeat(50));

    // Check if HF_TOKEN exists
    if (!process.env.HF_TOKEN) {
        console.log("❌ ERROR: No HF_TOKEN found in .env file");
        console.log("📁 Current directory:", __dirname);
        console.log("🔧 Please create .env file with: HF_TOKEN=your_token_here");

        const fallbackCategory = categorizeSkill(skillText);
        return res.json({
            labels: [fallbackCategory],
            scores: [0.9],
            note: "Using fallback - NO TOKEN"
        });
    } else {
        console.log("✅ HF_TOKEN exists (first 5 chars):", process.env.HF_TOKEN.substring(0, 5) + "...");
        console.log("✅ Token length:", process.env.HF_TOKEN.length);
    }

    try {
        // Dynamic import for node-fetch
        console.log("📡 Importing node-fetch...");
        const fetch = (await import('node-fetch')).default;
        console.log("✅ node-fetch imported");

        const API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli";
        console.log("📡 Calling Hugging Face API at:", API_URL);

        const requestBody = {
            inputs: skillText,
            parameters: {
                candidate_labels: ["gardening", "cooking", "repairs", "education", "technology", "moving", "pet care", "art", "music", "general"]
            }
        };
        console.log("📡 Request body:", JSON.stringify(requestBody, null, 2));

        const response = await fetch(API_URL, {
            headers: {
                Authorization: `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify(requestBody),
        });

        console.log("📡 Response status:", response.status);
        console.log("📡 Response status text:", response.statusText);

        // Get response headers
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        console.log("📡 Response headers:", headers);

        // Try to get response body
        const responseText = await response.text();
        console.log("📡 Response body:", responseText);

        if (!response.ok) {
            console.log("❌ API Error - Status:", response.status);
            console.log("❌ Error details:", responseText);
            throw new Error(`API responded with status: ${response.status}`);
        }

        // Parse the response
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.log("❌ Failed to parse response as JSON:", e.message);
            throw new Error("Invalid JSON response");
        }

        console.log("✅ AI Result:", result);

        // Check if result is an array (new API format)
        if (Array.isArray(result) && result.length > 0) {
            console.log("✅ Converting array format to expected format");

            // Extract labels and scores from the array
            const labels = result.map(item => item.label);
            const scores = result.map(item => item.score);

            console.log("✅ Converted labels:", labels);
            console.log("✅ Converted scores:", scores);

            return res.json({
                labels: labels,
                scores: scores
            });
        }
        // Check if it's already in the old format
        else if (result && result.labels && result.labels.length > 0) {
            console.log("✅ Using existing format");
            return res.json(result);
        }
        else {
            console.log("⚠️ Unexpected result format, using fallback");
            const fallbackCategory = categorizeSkill(skillText);
            return res.json({
                labels: [fallbackCategory],
                scores: [0.9],
                note: "Unexpected format, using fallback"
            });
        }

    } catch (error) {
        console.error("❌ AI Analysis failed:", error.message);
        if (error.stack) console.error("Stack:", error.stack);

        const fallbackCategory = categorizeSkill(skillText);
        res.json({
            labels: [fallbackCategory],
            scores: [0.9],
            note: "Using fallback due to API error"
        });
    }
});

// Helper function for fallback categorization
function categorizeSkill(text) {
    text = text.toLowerCase();

    if (text.includes('garden') || text.includes('plant') || text.includes('flower') || text.includes('lawn')) {
        return 'gardening';
    } else if (text.includes('cook') || text.includes('bake') || text.includes('food') || text.includes('meal') || text.includes('recipe')) {
        return 'cooking';
    } else if (text.includes('repair') || text.includes('fix') || text.includes('plumb') || text.includes('electrical') || text.includes('maintenance')) {
        return 'repairs';
    } else if (text.includes('teach') || text.includes('tutor') || text.includes('math') || text.includes('science') || text.includes('learn')) {
        return 'education';
    } else if (text.includes('computer') || text.includes('tech') || text.includes('website') || text.includes('code') || text.includes('programming')) {
        return 'technology';
    } else if (text.includes('move') || text.includes('furniture') || text.includes('box') || text.includes('lifting')) {
        return 'moving';
    } else if (text.includes('pet') || text.includes('dog') || text.includes('cat') || text.includes('walk')) {
        return 'pet care';
    } else if (text.includes('art') || text.includes('paint') || text.includes('draw') || text.includes('craft')) {
        return 'art';
    } else if (text.includes('music') || text.includes('guitar') || text.includes('piano') || text.includes('sing')) {
        return 'music';
    } else {
        return 'general';
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '../public')}`);
});