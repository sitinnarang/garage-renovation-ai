// GarageAI - Frontend JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initializeUpload();
    initializeNavigation();
    initializeContactForm();
});

// ==================== File Upload ====================

function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const removeBtn = document.getElementById('removeBtn');
    const optionsContainer = document.getElementById('optionsContainer');
    const generateBtn = document.getElementById('generateBtn');
    const resultsContainer = document.getElementById('resultsContainer');
    const regenerateBtn = document.getElementById('regenerateBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    let uploadedFile = null;
    let uploadedImageBase64 = null;

    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Handle uploaded file
    function handleFile(file) {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showNotification('Please upload a valid image file (JPG, PNG, or WEBP)', 'error');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showNotification('File size must be less than 10MB', 'error');
            return;
        }

        uploadedFile = file;

        // Convert to base64 for API
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageBase64 = e.target.result;
            previewImg.src = uploadedImageBase64;
            uploadArea.style.display = 'none';
            imagePreview.style.display = 'block';
            optionsContainer.style.display = 'block';
            optionsContainer.classList.add('fade-in');
        };
        reader.readAsDataURL(file);
    }

    // Remove uploaded image
    removeBtn.addEventListener('click', () => {
        uploadedFile = null;
        uploadedImageBase64 = null;
        previewImg.src = '';
        fileInput.value = '';
        imagePreview.style.display = 'none';
        uploadArea.style.display = 'block';
        optionsContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
    });

    // Generate AI design
    generateBtn.addEventListener('click', async () => {
        if (!uploadedImageBase64) {
            showNotification('Please upload an image first', 'error');
            return;
        }

        const style = document.querySelector('input[name="style"]:checked').value;
        const budget = document.getElementById('budget').value;
        const priority = document.getElementById('priority').value;

        // Show loading state
        const btnText = generateBtn.querySelector('.btn-text');
        const btnLoading = generateBtn.querySelector('.btn-loading');
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        generateBtn.disabled = true;

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: uploadedImageBase64,
                    style,
                    budget,
                    priority
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate design');
            }

            // Display results
            displayResults(data, uploadedImageBase64);
            
        } catch (error) {
            console.error('Error:', error);
            showNotification(error.message || 'Failed to generate design. Please try again.', 'error');
            
            // Show demo results for testing
            displayDemoResults(uploadedImageBase64, style, budget, priority);
        } finally {
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            generateBtn.disabled = false;
        }
    });

    // Regenerate
    regenerateBtn.addEventListener('click', () => {
        resultsContainer.style.display = 'none';
        optionsContainer.scrollIntoView({ behavior: 'smooth' });
    });

    // Download results
    downloadBtn.addEventListener('click', () => {
        downloadResults();
    });
}

// ==================== Display Results ====================

function displayResults(data, originalImage) {
    const resultsContainer = document.getElementById('resultsContainer');
    const beforeImage = document.getElementById('beforeImage');
    const afterImage = document.getElementById('afterImage');
    const totalCost = document.getElementById('totalCost');
    const costBreakdown = document.getElementById('costBreakdown');
    const suggestionsList = document.getElementById('suggestionsList');

    // Set images
    beforeImage.src = originalImage;
    afterImage.src = data.generatedImage || originalImage;

    // Set cost estimate
    totalCost.textContent = `$${data.estimate.total.toLocaleString()}`;

    // Build breakdown
    costBreakdown.innerHTML = data.estimate.breakdown.map(item => `
        <div class="breakdown-item">
            <span>${item.name}</span>
            <span>$${item.cost.toLocaleString()}</span>
        </div>
    `).join('');

    // Build suggestions
    suggestionsList.innerHTML = data.suggestions.map(suggestion => `
        <li>
            <span class="suggestion-icon">✨</span>
            <span>${suggestion}</span>
        </li>
    `).join('');

    // Show results
    resultsContainer.style.display = 'block';
    resultsContainer.classList.add('fade-in');
    resultsContainer.scrollIntoView({ behavior: 'smooth' });

    // Initialize comparison slider
    initializeComparisonSlider();
}

function displayDemoResults(originalImage, style, budget, priority) {
    const styleNames = {
        modern: 'Modern Minimalist',
        industrial: 'Industrial Style',
        workshop: 'Professional Workshop',
        gym: 'Home Gym',
        office: 'Home Office',
        storage: 'Smart Storage'
    };

    const budgetRanges = {
        low: { min: 2000, max: 4500 },
        medium: { min: 7000, max: 12000 },
        high: { min: 18000, max: 28000 },
        premium: { min: 35000, max: 55000 }
    };

    const range = budgetRanges[budget];
    const estimatedTotal = Math.floor(Math.random() * (range.max - range.min) + range.min);

    const demoData = {
        generatedImage: originalImage, // In real app, this would be AI generated
        estimate: {
            total: estimatedTotal,
            breakdown: [
                { name: 'Flooring (Epoxy/Tiles)', cost: Math.floor(estimatedTotal * 0.25) },
                { name: 'Wall Treatment', cost: Math.floor(estimatedTotal * 0.15) },
                { name: 'Lighting Installation', cost: Math.floor(estimatedTotal * 0.12) },
                { name: 'Storage Systems', cost: Math.floor(estimatedTotal * 0.20) },
                { name: 'Workbench/Equipment', cost: Math.floor(estimatedTotal * 0.18) },
                { name: 'Labor & Installation', cost: Math.floor(estimatedTotal * 0.10) }
            ]
        },
        suggestions: getSuggestions(style, priority)
    };

    displayResults(demoData, originalImage);
    showNotification('Demo mode: Connect to backend for AI-generated images', 'info');
}

function getSuggestions(style, priority) {
    const baseSuggestions = [
        'Install LED shop lights for better visibility and energy efficiency',
        'Add rubber or foam tiles for comfort when standing long periods',
        'Consider adding climate control for year-round use',
        'Install a pegboard system for tool organization'
    ];

    const styleSuggestions = {
        modern: [
            'Use clean white or gray epoxy flooring for a sleek look',
            'Install recessed LED panel lights for modern aesthetic',
            'Consider frameless glass panel doors for natural light'
        ],
        industrial: [
            'Expose ceiling beams and ducts for authentic industrial feel',
            'Use metal shelving and workbenches',
            'Add concrete sealant for durable industrial flooring'
        ],
        workshop: [
            'Install a heavy-duty workbench with built-in power outlets',
            'Add dust collection system for woodworking',
            'Consider a wall-mounted fold-down work table for flexibility'
        ],
        gym: [
            'Install rubber flooring rated for gym equipment',
            'Add full-length mirrors on one wall',
            'Ensure adequate ventilation and consider a ceiling fan'
        ],
        office: [
            'Insulate walls for temperature and noise control',
            'Install proper electrical for computers and equipment',
            'Consider adding a mini-split AC for climate control'
        ],
        storage: [
            'Use ceiling-mounted storage racks for seasonal items',
            'Install modular shelving that can be reconfigured',
            'Add clear bins with labels for easy organization'
        ]
    };

    const prioritySuggestions = {
        aesthetics: 'Consider accent lighting to highlight design features',
        functionality: 'Ensure adequate electrical outlets throughout the space',
        storage: 'Maximize vertical space with floor-to-ceiling storage',
        durability: 'Choose commercial-grade materials for longevity'
    };

    return [
        ...styleSuggestions[style].slice(0, 2),
        prioritySuggestions[priority],
        ...baseSuggestions.slice(0, 2)
    ];
}

// ==================== Comparison Slider ====================

function initializeComparisonSlider() {
    const slider = document.getElementById('comparisonSlider');
    const afterImage = document.getElementById('afterImage');

    if (!slider || !afterImage) return;

    slider.addEventListener('input', (e) => {
        const value = e.target.value;
        afterImage.style.clipPath = `polygon(${value}% 0, 100% 0, 100% 100%, ${value}% 100%)`;
    });

    // Initialize at 50%
    afterImage.style.clipPath = 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)';
}

// ==================== Navigation ====================

function initializeNavigation() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navigation highlight on scroll
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (scrollY >= sectionTop - 100) {
                current = section.getAttribute('id');
            }
        });

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// ==================== Contact Form ====================

function initializeContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        try {
            // In production, send to your backend
            console.log('Form submitted:', data);
            showNotification('Message sent successfully! We\'ll get back to you soon.', 'success');
            form.reset();
        } catch (error) {
            showNotification('Failed to send message. Please try again.', 'error');
        }
    });
}

// ==================== Utility Functions ====================

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;

    // Add styles dynamically
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#4f46e5'};
        color: white;
        display: flex;
        align-items: center;
        gap: 1rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function downloadResults() {
    const resultsContainer = document.getElementById('resultsContainer');
    if (!resultsContainer) return;

    // Get data from the page
    const totalCost = document.getElementById('totalCost').textContent;
    const breakdownItems = document.querySelectorAll('.breakdown-item');
    const suggestions = document.querySelectorAll('.suggestions-list li');

    let content = '=== GARAGEAI RENOVATION ESTIMATE ===\n\n';
    content += `TOTAL ESTIMATED COST: ${totalCost}\n\n`;
    content += '--- COST BREAKDOWN ---\n';
    
    breakdownItems.forEach(item => {
        const spans = item.querySelectorAll('span');
        content += `${spans[0].textContent}: ${spans[1].textContent}\n`;
    });

    content += '\n--- AI RECOMMENDATIONS ---\n';
    suggestions.forEach((item, index) => {
        content += `${index + 1}. ${item.textContent.trim()}\n`;
    });

    content += '\n\nGenerated by GarageAI - ' + new Date().toLocaleDateString();

    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'garage-renovation-estimate.txt';
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Estimate downloaded successfully!', 'success');
}

// Add slideIn animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }
`;
document.head.appendChild(style);
