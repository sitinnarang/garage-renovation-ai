// AI Configuration - Add your API keys here
const AI_CONFIG = {
    // OpenAI API Key - Get from https://platform.openai.com/api-keys
    OPENAI_API_KEY: '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',
    
    // Model settings
    CHAT_MODEL: 'gpt-4-turbo-preview',
    VISION_MODEL: 'gpt-4-vision-preview',
    IMAGE_MODEL: 'dall-e-3',
    
    // Feature toggles
    ENABLE_CHAT: true,
    ENABLE_IMAGE_GEN: true,
    ENABLE_RECOMMENDATIONS: true,
    ENABLE_QUOTE_GENERATOR: true,
    
    // Pricing settings (for quote generator)
    PRICING: {
        epoxy_flooring_per_sqft: 8.50,
        cabinet_per_linear_ft: 450,
        slatwall_per_sqft: 12,
        led_lighting_per_fixture: 150,
        overhead_storage_per_unit: 800,
        labor_rate_per_hour: 75,
        consultation_fee: 0 // Free
    },
    
    // System prompts
    PROMPTS: {
        chat_assistant: `You are a helpful garage renovation expert for Garage Transformations. 
You help customers with questions about:
- Epoxy flooring options and installation
- Custom cabinet design and storage solutions
- Slatwall panels and organization systems
- LED lighting upgrades
- Complete garage makeovers

Be friendly, professional, and provide specific recommendations. 
If asked about pricing, give general ranges and encourage scheduling a free consultation.
Keep responses concise but helpful.`,

        product_recommendations: `Analyze this garage photo and recommend specific products from our catalog:
- Epoxy Flooring (colors: metallic silver, charcoal, sand beige)
- Custom Cabinets (types: tall storage, workbench, wall-mounted)
- Slatwall Panels (for tools, bikes, sports equipment)
- LED Lighting (hexagon panels, strip lights, motion sensors)
- Overhead Storage Racks

Provide 3-5 specific product recommendations based on the garage's:
1. Current condition and clutter level
2. Available wall and floor space
3. Apparent storage needs
Format as a JSON array with: name, reason, priority (high/medium/low), estimated_price`,

        quote_generator: `Analyze this garage photo and provide a detailed renovation quote estimate.
Assess:
1. Approximate garage size (single/double/triple car)
2. Current condition (needs full renovation vs partial)
3. Recommended services
4. Labor hours needed

Provide estimate in JSON format:
{
  "garage_size_sqft": number,
  "condition_assessment": "string",
  "recommended_services": [{"service": "name", "quantity": number, "unit": "sqft/linear_ft/each"}],
  "labor_hours": number,
  "notes": "string"
}`,

        image_generation: `Create a photorealistic interior design visualization of a luxury garage with: `
    }
};

// Don't modify below this line
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AI_CONFIG;
}
