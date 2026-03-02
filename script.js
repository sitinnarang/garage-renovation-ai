// Garage Living - Frontend JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeUpload();
    initializeGallerySliders();
    initializeGalleryFilters();
    initializeTestimonialsSlider();
    initializeConsultationForm();
    initializeSmoothScroll();
    initializeScrollAnimations();
});

// ==================== Navigation ====================

function initializeNavigation() {
    const navbar = document.querySelector('.navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');

    // Navbar scroll effect
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
        } else {
            navbar.style.boxShadow = '0 2px 15px rgba(0,0,0,0.08)';
        }

        lastScroll = currentScroll;
    });

    // Mobile menu toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('mobile-active');
            mobileMenuBtn.innerHTML = navLinks.classList.contains('mobile-active') 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="fas fa-bars"></i>';
        });
    }

    // Close mobile menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks.classList.contains('mobile-active')) {
                navLinks.classList.remove('mobile-active');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    });
}

// ==================== Smooth Scroll ====================

function initializeSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                const navHeight = document.querySelector('.navbar').offsetHeight;
                const topBarHeight = document.querySelector('.top-bar')?.offsetHeight || 0;
                const offset = navHeight + topBarHeight + 20;
                
                window.scrollTo({
                    top: target.offsetTop - offset,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ==================== Gallery Before/After Sliders ====================

function initializeGallerySliders() {
    const sliders = document.querySelectorAll('.ba-slider');
    
    sliders.forEach(slider => {
        const container = slider.closest('.before-after-container');
        const afterImage = container.querySelector('.after-image');
        const handle = container.querySelector('.ba-handle');
        
        // Initialize at 50%
        updateSliderPosition(slider, afterImage, handle, 50);
        
        // Mouse/Touch events
        slider.addEventListener('input', (e) => {
            updateSliderPosition(slider, afterImage, handle, e.target.value);
        });
    });
}

function updateSliderPosition(slider, afterImage, handle, value) {
    const percentage = 100 - value;
    afterImage.style.clipPath = `inset(0 ${percentage}% 0 0)`;
    handle.style.left = `${value}%`;
}

// ==================== Gallery Filters ====================

function initializeGalleryFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;

            galleryItems.forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                    item.style.display = 'block';
                    item.style.animation = 'fadeIn 0.5s ease';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// ==================== Testimonials Slider ====================

function initializeTestimonialsSlider() {
    const slider = document.querySelector('.testimonials-slider');
    const cards = document.querySelectorAll('.testimonial-card');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    if (!slider || cards.length === 0) return;

    let currentIndex = 0;
    let autoSlideInterval;

    function updateSlider(index) {
        // On mobile, scroll to the selected testimonial
        if (window.innerWidth <= 1024) {
            slider.scrollTo({
                left: cards[index].offsetLeft - slider.offsetLeft,
                behavior: 'smooth'
            });
        }
        
        // Update dots
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
        
        currentIndex = index;
    }

    // Navigation buttons
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + cards.length) % cards.length;
            updateSlider(currentIndex);
            resetAutoSlide();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % cards.length;
            updateSlider(currentIndex);
            resetAutoSlide();
        });
    }

    // Dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            updateSlider(index);
            resetAutoSlide();
        });
    });

    // Auto slide
    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % cards.length;
            updateSlider(currentIndex);
        }, 5000);
    }

    function resetAutoSlide() {
        clearInterval(autoSlideInterval);
        startAutoSlide();
    }

    startAutoSlide();
}

// ==================== File Upload (AI Design Tool) ====================

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

    if (!uploadArea) return;

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
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showNotification('Please upload a valid image file (JPG, PNG, or WEBP)', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showNotification('File size must be less than 10MB', 'error');
            return;
        }

        uploadedFile = file;

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
    if (removeBtn) {
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
    }

    // Generate AI design
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            if (!uploadedImageBase64) {
                showNotification('Please upload an image first', 'error');
                return;
            }

            const style = document.querySelector('input[name="style"]:checked')?.value || 'modern';

            // Show loading state
            const btnText = generateBtn.querySelector('.btn-text');
            const btnLoading = generateBtn.querySelector('.btn-loading');
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'inline-flex';
            generateBtn.disabled = true;

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: uploadedImageBase64,
                        style
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to generate design');
                }

                displayResults(data, uploadedImageBase64);
                
            } catch (error) {
                console.error('Error:', error);
                displayDemoResults(uploadedImageBase64, style);
            } finally {
                if (btnText) btnText.style.display = 'inline-flex';
                if (btnLoading) btnLoading.style.display = 'none';
                generateBtn.disabled = false;
            }
        });
    }

    // Regenerate
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
            resultsContainer.style.display = 'none';
            optionsContainer.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Download
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadResults);
    }
}

// ==================== Display Results ====================

function displayResults(data, originalImage) {
    const resultsContainer = document.getElementById('resultsContainer');
    const beforeImage = document.getElementById('beforeImage');
    const afterImage = document.getElementById('afterImage');
    const totalCost = document.getElementById('totalCost');
    const costBreakdown = document.getElementById('costBreakdown');

    if (beforeImage) beforeImage.src = originalImage;
    if (afterImage) afterImage.src = data.generatedImage || originalImage;
    if (totalCost) totalCost.textContent = `$${data.estimate.min.toLocaleString()} - $${data.estimate.max.toLocaleString()}`;

    if (costBreakdown) {
        costBreakdown.innerHTML = data.estimate.breakdown.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span>${item.name}</span>
                <span>$${item.cost.toLocaleString()}</span>
            </div>
        `).join('');
    }

    resultsContainer.style.display = 'block';
    resultsContainer.classList.add('fade-in');
    resultsContainer.scrollIntoView({ behavior: 'smooth' });

    // Initialize AI comparison slider
    initializeAIComparisonSlider();
}

function displayDemoResults(originalImage, style) {
    const budgetRanges = {
        modern: { min: 12000, max: 25000 },
        industrial: { min: 8000, max: 18000 },
        workshop: { min: 10000, max: 22000 },
        storage: { min: 6000, max: 15000 }
    };

    const range = budgetRanges[style] || budgetRanges.modern;

    const demoData = {
        generatedImage: originalImage,
        estimate: {
            min: range.min,
            max: range.max,
            breakdown: [
                { name: 'Flooring', cost: Math.floor(range.min * 0.30) },
                { name: 'Cabinets', cost: Math.floor(range.min * 0.25) },
                { name: 'Lighting', cost: Math.floor(range.min * 0.15) },
                { name: 'Organization', cost: Math.floor(range.min * 0.15) },
                { name: 'Installation', cost: Math.floor(range.min * 0.15) }
            ]
        }
    };

    displayResults(demoData, originalImage);
    showNotification('Schedule a consultation for an accurate quote', 'info');
}

function initializeAIComparisonSlider() {
    const slider = document.getElementById('comparisonSlider');
    const afterImage = document.getElementById('afterImage');

    if (!slider || !afterImage) return;

    slider.addEventListener('input', (e) => {
        const value = e.target.value;
        afterImage.style.clipPath = `polygon(${value}% 0, 100% 0, 100% 100%, ${value}% 100%)`;
    });

    afterImage.style.clipPath = 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)';
}

// ==================== Consultation Form ====================

function initializeConsultationForm() {
    const form = document.getElementById('consultationForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = {
            firstName: document.getElementById('firstName')?.value,
            lastName: document.getElementById('lastName')?.value,
            email: document.getElementById('email')?.value,
            phone: document.getElementById('phone')?.value,
            zipcode: document.getElementById('zipcode')?.value,
            interest: document.getElementById('interest')?.value,
            message: document.getElementById('message')?.value
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        try {
            // In production, send to backend
            console.log('Form submitted:', data);
            await new Promise(resolve => setTimeout(resolve, 1000));
            showNotification('Thank you! We\'ll contact you within 24 hours to schedule your consultation.', 'success');
            form.reset();
        } catch (error) {
            showNotification('Failed to submit. Please try again or call us at 1-866-465-4278.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// ==================== Scroll Animations ====================

function initializeScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements
    document.querySelectorAll('.service-card, .gallery-item, .process-step, .testimonial-card, .about-feature').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ==================== Utility Functions ====================

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const bgColor = type === 'error' ? '#c9372c' : type === 'success' ? '#27ae60' : '#2c3e50';
    
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        background: ${bgColor};
        color: white;
        display: flex;
        align-items: center;
        gap: 1rem;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        font-size: 0.95rem;
    `;

    document.body.appendChild(notification);

    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });

    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function downloadResults() {
    const totalCost = document.getElementById('totalCost')?.textContent || 'N/A';
    const breakdownItems = document.querySelectorAll('#costBreakdown > div');

    let content = '=== GARAGE LIVING - RENOVATION ESTIMATE ===\n\n';
    content += `ESTIMATED INVESTMENT: ${totalCost}\n\n`;
    content += '--- COST BREAKDOWN ---\n';
    
    breakdownItems.forEach(item => {
        const spans = item.querySelectorAll('span');
        if (spans.length >= 2) {
            content += `${spans[0].textContent}: ${spans[1].textContent}\n`;
        }
    });

    content += '\n--- NEXT STEPS ---\n';
    content += '1. Schedule your free in-home consultation\n';
    content += '2. Review your custom 3D design\n';
    content += '3. Get your detailed written estimate\n';
    content += '\nCall us at 1-866-465-4278\n';
    content += '\nGenerated by Garage Living - ' + new Date().toLocaleDateString();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'garage-living-estimate.txt';
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Estimate downloaded!', 'success');
}

// Add animations and mobile styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        opacity: 0.8;
        transition: opacity 0.2s;
    }
    .notification-close:hover {
        opacity: 1;
    }
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
    .nav-links.mobile-active {
        display: flex !important;
        position: fixed;
        top: 80px;
        left: 0;
        right: 0;
        background: white;
        flex-direction: column;
        padding: 20px;
        gap: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    @media (max-width: 768px) {
        .nav-links.mobile-active {
            top: 70px;
        }
    }
`;
document.head.appendChild(style);
