// GarageAI - Server with GitHub Models API Integration
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// GitHub Models API Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://models.inference.ai.azure.com/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

// Helper function to call GitHub Models API
async function callGitHubModels(messages, maxTokens = 500) {
    const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: messages,
            max_tokens: maxTokens,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// ==================== API Routes ====================

// Generate AI renovation design
app.post('/api/generate', async (req, res) => {
    try {
        const { image, style, budget, priority } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // If no GitHub token, return demo response
        if (!GITHUB_TOKEN) {
            const demoResponse = generateDemoResponse(style, budget, priority);
            return res.json({
                success: true,
                demo: true,
                generatedImage: image,
                ...demoResponse
            });
        }

        // Generate AI response with analysis and suggestions
        const analysisPrompt = buildAnalysisPrompt(style, budget, priority);
        
        // Get AI suggestions and cost estimate using GitHub Models API
        const response = await fetch(AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert garage renovation consultant. Analyze the garage image and provide detailed renovation suggestions and cost estimates.'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: analysisPrompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: image,
                                    detail: 'high'
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1500
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiAnalysis = data.choices[0].message.content;
        
        // Parse AI response and structure it
        const structuredResponse = parseAIResponse(aiAnalysis, style, budget, priority);

        // Note: GitHub Models API doesn't support DALL-E image generation
        // Return original image with AI analysis
        res.json({
            success: true,
            generatedImage: image,
            estimate: structuredResponse.estimate,
            suggestions: structuredResponse.suggestions,
            analysis: structuredResponse.analysis
        });

    } catch (error) {
        console.error('API Error:', error);
        
        // Return demo data if API fails
        const demoResponse = generateDemoResponse(req.body.style, req.body.budget, req.body.priority);
        res.json({
            success: true,
            demo: true,
            ...demoResponse
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array required' });
        }
        
        if (!GITHUB_TOKEN) {
            // Demo response when no API key
            return res.json({
                success: true,
                demo: true,
                response: "I'd be happy to help with your garage renovation! For detailed information, please schedule a free consultation. Our experts will assess your space and provide personalized recommendations."
            });
        }
        
        const response = await callGitHubModels(messages, 500);
        
        res.json({
            success: true,
            response: response
        });
        
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ 
            error: 'Failed to process chat',
            message: error.message 
        });
    }
});

// Image generation endpoint (GitHub Models API doesn't support DALL-E, using demo)
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt required' });
        }
        
        // GitHub Models API doesn't support image generation
        // Return curated demo images based on style keywords
        const demoImages = [
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1024&q=80',
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1024&q=80',
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1024&q=80'
        ];
        
        const randomImage = demoImages[Math.floor(Math.random() * demoImages.length)];
        
        res.json({
            success: true,
            demo: true,
            imageUrl: randomImage,
            message: 'Demo mode: Image generation requires OpenAI DALL-E API'
        });
        
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate image',
            message: error.message 
        });
    }
});

// Vision/Analysis endpoint
app.post('/api/analyze', async (req, res) => {
    try {
        const { imageBase64, prompt, systemPrompt } = req.body;
        
        if (!imageBase64 || !prompt) {
            return res.status(400).json({ error: 'Image and prompt required' });
        }
        
        if (!GITHUB_TOKEN) {
            return res.json({
                success: true,
                demo: true,
                response: JSON.stringify({
                    recommendations: [
                        { name: "Metallic Epoxy Flooring", reason: "Transform the floor with our premium coating", priority: "high", estimated_price: "$3,500" },
                        { name: "LED Hexagon Lights", reason: "Modern lighting upgrade", priority: "high", estimated_price: "$800" },
                        { name: "Custom Cabinets", reason: "Organized storage solution", priority: "medium", estimated_price: "$4,500" }
                    ]
                })
            });
        }
        
        // Use gpt-4o for vision tasks (supports images)
        const response = await fetch(AI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt || 'Analyze this garage image.' },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } }
                        ]
                    }
                ],
                max_tokens: 1500
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Vision API Error: ${response.status} - ${error}`);
        }
        
        const data = await response.json();
        
        res.json({
            success: true,
            response: data.choices[0].message.content
        });
        
    } catch (error) {
        console.error('Vision API Error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze image',
            message: error.message 
        });
    }
});

// ==================== Helper Functions ====================

function buildAnalysisPrompt(style, budget, priority) {
    const styleDescriptions = {
        modern: 'luxury automotive showroom style with hexagonal LED ceiling lights, metallic epoxy flooring, black cabinets with LED accents, slatwall organization',
        industrial: 'modern industrial with hexagonal lighting, exposed metal, concrete accents combined with sleek storage',
        workshop: 'professional automotive workshop with hexagonal LED lighting, epoxy floors, heavy-duty workbenches, tool organization',
        gym: 'high-end home gym conversion with modern lighting, rubber flooring zones, mirrors, ventilation',
        office: 'converted garage office with modern lighting, climate control, acoustic treatment, dedicated workspace',
        storage: 'maximized storage with ceiling racks, modular systems, LED lighting, organized zones'
    };

    const budgetRanges = {
        low: '$1,000 - $5,000',
        medium: '$5,000 - $15,000',
        high: '$15,000 - $30,000',
        premium: '$30,000+'
    };

    return `
        Analyze this garage image and provide renovation recommendations.
        
        DESIRED STYLE: ${style} - ${styleDescriptions[style]}
        BUDGET RANGE: ${budgetRanges[budget]}
        MAIN PRIORITY: ${priority}
        
        Please provide:
        1. Assessment of the current garage condition
        2. Specific renovation recommendations for the ${style} style
        3. Detailed cost breakdown within the ${budgetRanges[budget]} budget
        4. 5 actionable suggestions focused on ${priority}
        
        Format your cost estimates as JSON with the following structure:
        {
            "total": number,
            "breakdown": [
                {"name": "item name", "cost": number}
            ]
        }
    `;
}

function buildImagePrompt(style, budget, priority) {
    // Base template: luxurious modern garage with hexagonal LED ceiling lights, metallic epoxy flooring
    const baseTemplate = 'luxurious modern garage renovation featuring stunning hexagonal honeycomb LED ceiling lights creating dramatic reflections on glossy metallic flake epoxy flooring, black modern cabinets with warm under-cabinet LED strip lighting, clean white walls, black slatwall organization panels with tools';
    
    const styleDetails = {
        modern: `${baseTemplate}, sleek minimalist automotive showroom aesthetic, high-end car detailing garage style`,
        industrial: `${baseTemplate} combined with exposed metal ductwork, steel beam accents, raw concrete elements, urban loft garage aesthetic`,
        workshop: `${baseTemplate}, professional workbench with built-in tool organization, pegboard systems, heavy-duty equipment, automotive workshop vibe`,
        gym: `${baseTemplate} converted to home gym, rubber gym flooring section, wall mirrors, fitness equipment area, ventilation system`,
        office: `${baseTemplate} with dedicated office corner, modern desk setup, acoustic panels, climate controlled workspace`,
        storage: `${baseTemplate}, floor-to-ceiling storage systems, ceiling-mounted racks, organized bins, maximized vertical space`
    };

    return `Professional architectural interior photograph of a ${styleDetails[style]}. Dramatic lighting with hexagonal LED honeycomb pattern reflecting on glossy epoxy floor. High-end automotive garage aesthetic. Photorealistic, magazine quality, 8K detail. Focus on ${priority}. No people, no cars visible.`;
}

function parseAIResponse(aiResponse, style, budget, priority) {
    const budgetRanges = {
        low: { min: 2000, max: 4500 },
        medium: { min: 7000, max: 14000 },
        high: { min: 18000, max: 28000 },
        premium: { min: 35000, max: 55000 }
    };

    // Try to extract cost data from AI response
    let total = Math.floor(Math.random() * (budgetRanges[budget].max - budgetRanges[budget].min) + budgetRanges[budget].min);
    
    // Look for JSON in the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*"total"[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.total) total = parsed.total;
        } catch (e) {
            // Use calculated estimate
        }
    }

    // Generate breakdown based on style
    const breakdown = generateCostBreakdown(total, style);

    // Extract suggestions from AI response or generate defaults
    const suggestions = extractSuggestions(aiResponse, style, priority);

    return {
        estimate: {
            total,
            breakdown
        },
        suggestions,
        analysis: aiResponse
    };
}

function generateCostBreakdown(total, style) {
    const breakdowns = {
        modern: [
            { name: 'Hexagonal LED Ceiling Lights', pct: 0.20 },
            { name: 'Metallic Flake Epoxy Flooring', pct: 0.22 },
            { name: 'Black Modern Cabinets', pct: 0.18 },
            { name: 'Slatwall Organization System', pct: 0.10 },
            { name: 'Under-Cabinet LED Strips', pct: 0.08 },
            { name: 'Wall Prep & Paint (White)', pct: 0.10 },
            { name: 'Labor & Installation', pct: 0.12 }
        ],
        industrial: [
            { name: 'Hexagonal LED Lighting', pct: 0.18 },
            { name: 'Polished Concrete/Epoxy Floor', pct: 0.20 },
            { name: 'Metal Shelving Systems', pct: 0.18 },
            { name: 'Exposed Metal Ductwork', pct: 0.12 },
            { name: 'Industrial Work Tables', pct: 0.15 },
            { name: 'Labor & Installation', pct: 0.17 }
        ],
        workshop: [
            { name: 'Hexagonal LED Shop Lights', pct: 0.18 },
            { name: 'Heavy-Duty Epoxy Flooring', pct: 0.18 },
            { name: 'Professional Workbench', pct: 0.20 },
            { name: 'Tool Storage & Pegboard', pct: 0.15 },
            { name: 'Electrical Upgrades (220V)', pct: 0.16 },
            { name: 'Labor & Installation', pct: 0.13 }
        ],
        gym: [
            { name: 'Hexagonal LED Lighting', pct: 0.15 },
            { name: 'Rubber Gym Flooring', pct: 0.22 },
            { name: 'Full Wall Mirrors', pct: 0.15 },
            { name: 'Climate Control (Mini-Split)', pct: 0.20 },
            { name: 'Ventilation System', pct: 0.12 },
            { name: 'Labor & Installation', pct: 0.16 }
        ],
        office: [
            { name: 'Modern LED Lighting', pct: 0.12 },
            { name: 'Premium Flooring', pct: 0.18 },
            { name: 'Insulation & Drywall', pct: 0.20 },
            { name: 'HVAC Mini-Split', pct: 0.20 },
            { name: 'Electrical & Tech Setup', pct: 0.18 },
            { name: 'Labor & Installation', pct: 0.12 }
        ],
        storage: [
            { name: 'LED Lighting System', pct: 0.10 },
            { name: 'Epoxy Floor Coating', pct: 0.15 },
            { name: 'Wall Shelving Systems', pct: 0.25 },
            { name: 'Ceiling Storage Racks', pct: 0.20 },
            { name: 'Modern Cabinets & Bins', pct: 0.18 },
            { name: 'Labor & Installation', pct: 0.12 }
        ]
    };

    const items = breakdowns[style] || breakdowns.modern;
    return items.map(item => ({
        name: item.name,
        cost: Math.round(total * item.pct)
    }));
}

function extractSuggestions(aiResponse, style, priority) {
    const defaultSuggestions = {
        modern: [
            'Install hexagonal honeycomb LED ceiling lights for dramatic showroom-style lighting',
            'Apply metallic flake epoxy flooring in charcoal gray for stunning light reflections',
            'Add black modular cabinets with warm LED under-cabinet strip lighting',
            'Install black slatwall panels for tool and accessory organization',
            'Paint walls crisp white to maximize light reflection and contrast'
        ],
        industrial: [
            'Combine hexagonal LED lighting with exposed metal ductwork for modern-industrial fusion',
            'Use polished concrete or metallic epoxy for authentic industrial flooring',
            'Install heavy-duty metal shelving with LED strip accents',
            'Add vintage-style metal signage as accent pieces',
            'Consider raw steel workbenches with protective clear coat'
        ],
        workshop: [
            'Install bright hexagonal LED shop lights for shadow-free work areas',
            'Apply chemical-resistant epoxy flooring in dark gray with flakes',
            'Build a professional-grade workbench with built-in power and USB outlets',
            'Add a comprehensive pegboard and slatwall tool organization system',
            'Ensure adequate 220V circuits for welders and heavy equipment'
        ],
        gym: [
            'Use hexagonal LED panels for energizing workout lighting',
            'Install rubber gym tiles over epoxy base in designated workout zones',
            'Add floor-to-ceiling mirrors on at least one wall',
            'Install a mini-split AC system for year-round climate control',
            'Add ceiling-mounted fans for air circulation during intense workouts'
        ],
        office: [
            'Install modern LED panel lighting for comfortable work environment',
            'Apply premium flooring like luxury vinyl plank over epoxy base',
            'Add proper insulation (R-19 minimum) for energy efficiency and sound',
            'Install a mini-split AC system for year-round climate control',
            'Add ethernet wiring and multiple USB-C charging outlets'
        ],
        storage: [
            'Install LED strip lighting in all storage areas for visibility',
            'Apply epoxy flooring for easy cleaning and durability',
            'Use ceiling-mounted racks for seasonal and bulky items',
            'Install modular slatwall and shelving systems for flexibility',
            'Add clear labeled bins and create organized zones by category'
        ]
    };

    return defaultSuggestions[style] || defaultSuggestions.modern;
}

function generateDemoResponse(style, budget, priority) {
    const budgetRanges = {
        low: { min: 2000, max: 4500 },
        medium: { min: 7000, max: 14000 },
        high: { min: 18000, max: 28000 },
        premium: { min: 35000, max: 55000 }
    };

    const range = budgetRanges[budget] || budgetRanges.medium;
    const total = Math.floor(Math.random() * (range.max - range.min) + range.min);

    return {
        generatedImage: null,
        estimate: {
            total,
            breakdown: generateCostBreakdown(total, style || 'modern')
        },
        suggestions: extractSuggestions('', style || 'modern', priority || 'functionality')
    };
}

// ==================== Start Server ====================

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════╗
    ║      GarageAI Server Running!              ║
    ║      http://localhost:${PORT}                 ║
    ╠════════════════════════════════════════════╣
    ║  OpenAI API: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Not configured'}           ║
    ╚════════════════════════════════════════════╝
    `);
});

module.exports = app;
