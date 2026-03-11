// GarageAI - Server with GitHub Models API Integration
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite Database Setup
const DB_PATH = path.join(__dirname, 'garage_consultations.db');
const db = new sqlite3.Database(DB_PATH);

// Create consultations table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            service TEXT,
            message TEXT,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'new'
        )
    `);
    
    // Create garage_images table for AR visualization
    db.run(`
        CREATE TABLE IF NOT EXISTS garage_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_data TEXT NOT NULL,
            filename TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Create image_cache table for caching AI-generated results
    db.run(`
        CREATE TABLE IF NOT EXISTS image_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_hash TEXT UNIQUE NOT NULL,
            modernization TEXT,
            generated_image TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('SQLite database initialized');
});

// GitHub Models API Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://models.inference.ai.azure.com/chat/completions';

// OpenAI API Configuration (for image generation)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGE_EDIT_ENDPOINT = 'https://api.openai.com/v1/images/edits';

// Anthropic Claude API Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

// Helper function to call Claude API with vision
async function callClaudeVision(imageData, prompt) {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageData.split(';')[0].split(':')[1] || 'image/jpeg',
                                data: imageData.split(',')[1]
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }
            ]
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API Error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
}
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

// ==================== Garage Images API ====================

// Get all saved garage images
app.get('/api/garage-images', (req, res) => {
    db.all('SELECT id, image_data, filename, created_at FROM garage_images ORDER BY created_at DESC LIMIT 10', [], (err, rows) => {
        if (err) {
            console.error('Error fetching images:', err);
            return res.status(500).json({ error: 'Failed to fetch images' });
        }
        res.json({ images: rows });
    });
});

// Save a new garage image
app.post('/api/garage-images', (req, res) => {
    const { image_data, filename } = req.body;
    
    if (!image_data) {
        return res.status(400).json({ error: 'No image data provided' });
    }
    
    // Check count and delete oldest if over 10
    db.get('SELECT COUNT(*) as count FROM garage_images', [], (err, row) => {
        if (row && row.count >= 10) {
            db.run('DELETE FROM garage_images WHERE id = (SELECT id FROM garage_images ORDER BY created_at ASC LIMIT 1)');
        }
        
        db.run(
            'INSERT INTO garage_images (image_data, filename) VALUES (?, ?)',
            [image_data, filename || 'garage_image.jpg'],
            function(err) {
                if (err) {
                    console.error('Error saving image:', err);
                    return res.status(500).json({ error: 'Failed to save image' });
                }
                res.json({ success: true, id: this.lastID });
            }
        );
    });
});

// Delete a garage image
app.delete('/api/garage-images/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM garage_images WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Error deleting image:', err);
            return res.status(500).json({ error: 'Failed to delete image' });
        }
        res.json({ success: true, deleted: this.changes });
    });
});

// Delete all garage images
app.delete('/api/garage-images', (req, res) => {
    db.run('DELETE FROM garage_images', [], function(err) {
        if (err) {
            console.error('Error clearing images:', err);
            return res.status(500).json({ error: 'Failed to clear images' });
        }
        res.json({ success: true, deleted: this.changes });
    });
});

// Validate if image is a garage/cabinet related image
app.post('/api/validate-garage-image', async (req, res) => {
    const { image } = req.body;
    
    if (!image) {
        return res.status(400).json({ valid: false, error: 'No image provided' });
    }
    
    // If no GitHub token, do basic validation (allow all)
    if (!GITHUB_TOKEN) {
        return res.json({ 
            valid: true, 
            message: 'Image accepted (AI validation unavailable)',
            detected: 'garage'
        });
    }
    
    try {
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
                        content: 'You are an image classifier. Analyze the image and determine if it shows a garage, cabinet, storage system, workshop, or related renovation space. Respond with JSON only: {"isGarage": boolean, "detected": string, "confidence": number}. "detected" should describe what you see (e.g., "garage interior", "storage cabinet", "kitchen", "landscape", etc). "confidence" is 0-100.'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Is this image a garage, cabinet, storage area, or workshop? Classify it.'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: image,
                                    detail: 'low'
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 150
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Parse AI response
        let result;
        try {
            result = JSON.parse(aiResponse.match(/\{[\s\S]*\}/)?.[0] || '{}');
        } catch {
            result = { isGarage: true, detected: 'unknown', confidence: 50 };
        }
        
        if (result.isGarage) {
            res.json({
                valid: true,
                message: `Detected: ${result.detected}`,
                detected: result.detected,
                confidence: result.confidence
            });
        } else {
            res.json({
                valid: false,
                message: `This doesn't appear to be a garage image. Detected: ${result.detected}`,
                detected: result.detected,
                confidence: result.confidence
            });
        }
        
    } catch (error) {
        console.error('Image validation error:', error);
        // On error, allow the image (fail open)
        res.json({ 
            valid: true, 
            message: 'Validation skipped',
            detected: 'unknown'
        });
    }
});

// AI Modernize Garage - Transform image with gpt-image-1 (with caching)
app.post('/api/modernize-garage', async (req, res) => {
    const { imageData } = req.body;
    
    if (!imageData) {
        return res.status(400).json({ error: 'No image provided' });
    }
    
    // Check for required API keys
    if (!OPENAI_API_KEY) {
        return res.json({
            success: true,
            modernization: `Vision: Sleek Modern Garage with Premium Finish

1. **Flooring**: Install epoxy coating with metallic flake finish in charcoal gray.
2. **Lighting**: Add hexagonal LED ceiling panels with RGB capability.
3. **Storage Cabinets**: Premium modular cabinet system in matte black.
4. **Wall Treatment**: Apply textured slatwall panels in graphite.
5. **Smart Tech**: Integrate smart home controls for lighting and climate.
6. **Workspace**: Add stainless steel workbench with LED task lighting.`,
            generatedImage: null,
            demo: true
        });
    }
    
    try {
        // Generate hash of the image for caching
        const imageHash = crypto.createHash('md5').update(imageData).digest('hex');
        console.log('Image hash:', imageHash);
        
        // Check cache first
        const cached = await new Promise((resolve, reject) => {
            db.get(
                'SELECT modernization, generated_image FROM image_cache WHERE image_hash = ?',
                [imageHash],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (cached && cached.generated_image) {
            console.log('Cache HIT - Returning cached result');
            return res.json({
                success: true,
                modernization: cached.modernization,
                generatedImage: cached.generated_image,
                cached: true
            });
        }
        
        console.log('Cache MISS - Using OpenAI gpt-image-1 for image transformation...');
        
        // Extract base64 data and convert to buffer (like ChatGPT example)
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        let generatedImage = null;
        let modernization = `Vision: Premium Modern Garage Transformation

1. **Flooring**: Polished gray epoxy with metallic flake finish for a sleek showroom look.
2. **Lighting**: Hexagonal LED ceiling panels providing bright, even illumination throughout.
3. **Storage**: Black modular cabinet system with soft-close drawers and stainless handles.
4. **Walls**: Clean white and charcoal gray paint for a modern, premium feel.
5. **Organization**: Wall-mounted tool storage and dedicated workbench area.
6. **Atmosphere**: Car showroom ambiance with professional-grade lighting.`;
        
        try {
            console.log('Calling gpt-image-1 via OpenAI SDK with toFile...');
            
            // Initialize OpenAI client with latest SDK
            const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
            
            // Convert buffer to File using OpenAI's toFile helper
            const { toFile } = await import('openai');
            const imageFile = await toFile(imageBuffer, 'garage.png', { type: 'image/png' });
            
            // Use images.edit which supports image input with gpt-image-1
            const imageResponse = await openai.images.edit({
                model: 'gpt-image-1',
                image: imageFile,
                prompt: `Transform this garage into a modern luxury garage.
Keep the original room layout, perspective, camera angle, and any vehicles in their positions.
Add polished gray epoxy flooring with metallic flakes, clean white and charcoal walls,
modern hexagonal LED ceiling panel lights, sleek black storage cabinets, organized tools,
and a premium automotive showroom feel.`,
                size: '1024x1024'
            });
            
            if (imageResponse.data && imageResponse.data[0]) {
                if (imageResponse.data[0].b64_json) {
                    generatedImage = `data:image/png;base64,${imageResponse.data[0].b64_json}`;
                } else if (imageResponse.data[0].url) {
                    const imgFetch = await fetch(imageResponse.data[0].url);
                    const imgBuffer = await imgFetch.arrayBuffer();
                    const imgBase64 = Buffer.from(imgBuffer).toString('base64');
                    generatedImage = `data:image/png;base64,${imgBase64}`;
                }
                console.log('gpt-image-1 transformation successful!');
            }
        } catch (editError) {
            console.error('gpt-image-1 error:', editError.message);
            
            // Fallback to DALL-E 3 if gpt-image-1 fails
            console.log('Falling back to DALL-E 3...');
            const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
            const fallbackResponse = await openai.images.generate({
                model: 'dall-e-3',
                prompt: 'Photorealistic modern luxury garage interior with polished gray epoxy floor with metallic flakes, hexagonal LED ceiling panels in honeycomb pattern, sleek black modular cabinets, premium car showroom atmosphere, professional photography, clean white and charcoal walls',
                n: 1,
                size: '1024x1024',
                quality: 'hd',
                response_format: 'b64_json'
            });
            
            if (fallbackResponse.data && fallbackResponse.data[0]) {
                generatedImage = `data:image/png;base64,${fallbackResponse.data[0].b64_json}`;
                console.log('DALL-E 3 fallback successful');
            }
        }
        
        // Save to cache if we got a generated image
        if (generatedImage) {
            db.run(
                'INSERT OR REPLACE INTO image_cache (image_hash, modernization, generated_image) VALUES (?, ?, ?)',
                [imageHash, modernization, generatedImage],
                (err) => {
                    if (err) console.error('Cache save error:', err);
                    else console.log('Result cached for future requests');
                }
            );
        }
        
        res.json({
            success: true,
            modernization,
            generatedImage,
            cached: false
        });
        
    } catch (error) {
        console.error('Modernize error:', error);
        res.status(500).json({ error: 'Failed to generate modernization plan' });
    }
});

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

// Image generation endpoint (using OpenAI DALL-E)
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt required' });
        }
        
        // If no OpenAI key, return demo image
        if (!OPENAI_API_KEY) {
            return res.json({
                success: true,
                demo: true,
                imageUrl: '/images/IMG_3112.webp',
                message: 'Demo mode: Image generation requires OpenAI API key'
            });
        }
        
        console.log('Generating design image with DALL-E 3...');
        
        const imageResponse = await fetch(OPENAI_IMAGE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: prompt,
                n: 1,
                size: '1024x1024',
                quality: 'hd',
                response_format: 'b64_json'
            })
        });
        
        if (!imageResponse.ok) {
            const error = await imageResponse.text();
            console.error('DALL-E Error:', error);
            throw new Error('Image generation failed');
        }
        
        const result = await imageResponse.json();
        if (result.data && result.data[0]) {
            const imageUrl = `data:image/png;base64,${result.data[0].b64_json}`;
            console.log('Design image generated successfully!');
            
            res.json({
                success: true,
                imageUrl: imageUrl
            });
        } else {
            throw new Error('No image data returned');
        }
        
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

// ==================== Consultation Form API ====================

// Submit consultation form
app.post('/api/consultation', (req, res) => {
    const { name, email, phone, service, message } = req.body;
    
    // Validate required fields
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // Insert into SQLite database
    const sql = `INSERT INTO consultations (name, email, phone, service, message) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [name, email, phone || '', service || '', message || ''], function(err) {
        if (err) {
            console.error('Error saving consultation:', err);
            return res.status(500).json({ error: 'Failed to save consultation' });
        }
        
        console.log(`New consultation received from ${name} (${email}) - ID: ${this.lastID}`);
        
        res.json({ 
            success: true, 
            message: 'Thank you! We will contact you soon.',
            id: this.lastID 
        });
    });
});

// Get all consultations (admin endpoint)
app.get('/api/consultations', (req, res) => {
    const sql = `SELECT * FROM consultations ORDER BY submitted_at DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error reading consultations:', err);
            return res.status(500).json({ error: 'Failed to read consultations' });
        }
        res.json(rows);
    });
});

// Delete a consultation
app.delete('/api/consultation/:id', (req, res) => {
    const { id } = req.params;
    
    db.run(`DELETE FROM consultations WHERE id = ?`, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete' });
        }
        res.json({ success: true, deleted: this.changes });
    });
});

// Update consultation status
app.patch('/api/consultation/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    db.run(`UPDATE consultations SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update' });
        }
        res.json({ success: true, updated: this.changes });
    });
});

// ==================== Start Server ====================

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════╗
    ║      GarageAI Server Running!              ║
    ║      http://localhost:${PORT}                 ║
    ╠════════════════════════════════════════════╣
    ║  GitHub AI: ${process.env.GITHUB_TOKEN ? '✓ Configured' : '✗ Not configured'}              ║
    ╚════════════════════════════════════════════╝
    `);
});

module.exports = app;
