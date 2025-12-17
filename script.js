// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 70,
                behavior: 'smooth'
            });
        }
    });
});

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav ul');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            nav.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });
    }
});

// Set minimum check-in date to today
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('checkin').setAttribute('min', today);
});

// Set minimum check-out date based on check-in date
document.getElementById('checkin').addEventListener('change', function() {
    const checkinDate = new Date(this.value);
    const minCheckout = new Date(checkinDate);
    minCheckout.setDate(minCheckout.getDate() + 1);
    const minCheckoutStr = minCheckout.toISOString().split('T')[0];
    document.getElementById('checkout').setAttribute('min', minCheckoutStr);
});

// Handle room booking buttons
document.querySelectorAll('.room-card .btn-primary').forEach(button => {
    button.addEventListener('click', function(e) {
        // Prevent default behavior since we're recommending Airbnb
        e.preventDefault();
        
        // Get the Airbnb link from the parent's first anchor element
        const airbnbLink = this.parentElement.querySelector('a[href*="airbnb"]').href;
        
        // Open Airbnb link in new tab
        window.open(airbnbLink, '_blank');
    });
});

// Handle room booking buttons for direct booking (now enabled)
document.querySelectorAll('.room-card .btn-secondary').forEach(button => {
    button.addEventListener('click', function(e) {
        // Prevent default behavior
        e.preventDefault();
        
        // Get the room type from the data attribute
        const roomType = this.getAttribute('data-room');
        
        // Scroll to the booking form
        const bookingSection = document.getElementById('booking');
        if (bookingSection) {
            // Set the room type in the dropdown
            const roomTypeSelect = document.getElementById('room-type');
            if (roomTypeSelect) {
                roomTypeSelect.value = roomType;
            }
            
            // Scroll to the booking section
            bookingSection.scrollIntoView({ behavior: 'smooth' });
            
            // Highlight the form for better UX
            const bookingForm = document.getElementById('booking-form');
            if (bookingForm) {
                bookingForm.style.boxShadow = '0 0 15px rgba(255, 165, 0, 0.5)';
                setTimeout(() => {
                    bookingForm.style.boxShadow = '';
                }, 3000);
            }
        }
    });
});

// Helper function to get room type name
function getRoomTypeName(roomType) {
    const roomTypes = {
        'executive': 'Executive Room',
        'regular': 'Regular Bedroom',
        'full-house': 'Full House'
    };
    return roomTypes[roomType] || 'Room';
}

// Video player is now embedded directly in the HTML
// No additional JavaScript needed for video playback

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals for images and videos
    initGalleryModals();
    
    // Initialize video autoplay functionality
    initVideoAutoplay();
    
    // Initialize flyer preview functionality
    initFlyerPreview();
});

// Scroll to top functionality
document.addEventListener('DOMContentLoaded', function() {
    const scrollToTopButton = document.getElementById('scrollToTop');
    
    // Check if the button exists
    if (scrollToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollToTopButton.classList.add('visible');
            } else {
                scrollToTopButton.classList.remove('visible');
            }
        });

        scrollToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

// Gallery modal functionality
function initGalleryModals() {
    // Create image modal
    const imageModal = document.createElement('div');
    imageModal.className = 'image-modal';
    const imageModalContent = document.createElement('div');
    imageModalContent.className = 'image-modal-content';
    const imageModalImg = document.createElement('img');
    const closeImageModalBtn = document.createElement('button');
    closeImageModalBtn.className = 'close-modal-btn';
    closeImageModalBtn.innerHTML = '&times;';
    
    imageModalContent.appendChild(imageModalImg);
    imageModalContent.appendChild(closeImageModalBtn);
    imageModal.appendChild(imageModalContent);
    document.body.appendChild(imageModal);
    
    // Create video modal
    const videoModal = document.createElement('div');
    videoModal.className = 'video-modal';
    const videoModalContent = document.createElement('div');
    videoModalContent.className = 'video-modal-content';
    const modalVideo = document.createElement('video');
    modalVideo.controls = true;
    modalVideo.muted = true; // Add muted attribute for better compatibility
    modalVideo.playsInline = true; // Add playsInline attribute for mobile
    // Create source element dynamically
    const modalVideoSource = document.createElement('source');
    modalVideoSource.type = 'video/mp4';
    modalVideo.appendChild(modalVideoSource);
    // Add fallback text
    modalVideo.appendChild(document.createTextNode('Your browser does not support the video tag.'));
    const closeVideoModalBtn = document.createElement('button');
    closeVideoModalBtn.className = 'close-modal-btn';
    closeVideoModalBtn.innerHTML = '&times;';
    
    videoModalContent.appendChild(modalVideo);
    videoModalContent.appendChild(closeVideoModalBtn);
    videoModal.appendChild(videoModalContent);
    document.body.appendChild(videoModal);
    
    // Handle expand button clicks for images
    document.querySelectorAll('.gallery-item:not(.video-container) .expand-btn').forEach((btn, index) => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const imgSrc = this.closest('.gallery-item').querySelector('img').src;
            imageModalImg.src = imgSrc;
            imageModal.style.display = 'flex';
        });
    });
    
    // Handle double-click on images to expand them
    document.querySelectorAll('.gallery-item:not(.video-container)').forEach((item, index) => {
        item.addEventListener('dblclick', function(e) {
            // Prevent double-click from triggering if it's on the expand button itself
            if (e.target.classList.contains('expand-btn')) return;
            
            const imgSrc = this.querySelector('img').src;
            imageModalImg.src = imgSrc;
            imageModal.style.display = 'flex';
        });
    });
    
    // Handle expand button clicks for videos
    document.querySelectorAll('.video-container .expand-btn').forEach((btn, index) => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const videoSrc = this.closest('.video-container').querySelector('video source').src;
            modalVideoSource.src = videoSrc;
            modalVideo.load();
            videoModal.style.display = 'flex';
            // Pause all videos when expanding
            document.querySelectorAll('video').forEach(video => {
                if (video !== modalVideo) {
                    video.pause();
                }
            });
            // Play the modal video with muted attribute for autoplay compatibility
            setTimeout(() => {
                modalVideo.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                    // If autoplay fails, show a visual cue to click
                    modalVideo.setAttribute('title', 'Click to play');
                });
            }, 100);
        });
    });
    
    // Handle double-click on videos to expand them
    document.querySelectorAll('.video-container').forEach((item, index) => {
        item.addEventListener('dblclick', function(e) {
            // Prevent double-click from triggering if it's on the expand button itself
            if (e.target.classList.contains('expand-btn')) return;
            
            const videoSrc = this.querySelector('video source').src;
            modalVideoSource.src = videoSrc;
            modalVideo.load();
            videoModal.style.display = 'flex';
            // Pause all videos when expanding
            document.querySelectorAll('video').forEach(video => {
                if (video !== modalVideo) {
                    video.pause();
                }
            });
            // Play the modal video with muted attribute for autoplay compatibility
            setTimeout(() => {
                modalVideo.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                    // If autoplay fails, show a visual cue to click
                    modalVideo.setAttribute('title', 'Click to play');
                });
            }, 100);
        });
    });
    
    // Close image modal
    closeImageModalBtn.addEventListener('click', function() {
        imageModal.style.display = 'none';
    });
    
    // Close video modal
    closeVideoModalBtn.addEventListener('click', function() {
        videoModal.style.display = 'none';
        modalVideo.pause();
        modalVideo.currentTime = 0;
        // Resume visible videos if they were playing
        document.querySelectorAll('.video-container').forEach(container => {
            const video = container.querySelector('video');
            const isVideoVisible = isElementInViewport(container);
            if (isVideoVisible) {
                video.play().catch(e => console.log('Autoplay prevented:', e));
            }
        });
    });
    
    // Close modals when clicking outside
    imageModal.addEventListener('click', function(e) {
        if (e.target === imageModal) {
            imageModal.style.display = 'none';
        }
    });
    
    videoModal.addEventListener('click', function(e) {
        if (e.target === videoModal) {
            videoModal.style.display = 'none';
            modalVideo.pause();
            modalVideo.currentTime = 0;
            // Resume visible videos if they were playing
            document.querySelectorAll('.video-container').forEach(container => {
                const video = container.querySelector('video');
                const isVideoVisible = isElementInViewport(container);
                if (isVideoVisible) {
                    video.play().catch(e => console.log('Autoplay prevented:', e));
                }
            });
        }
    });
}

// Video autoplay functionality
function initVideoAutoplay() {
    // Get all videos that should have autoplay functionality
    const videos = [
        document.getElementById('gallery-video'),
        document.getElementById('gallery-video-2'),
        document.getElementById('gallery-video-3'),
        document.getElementById('motivation-video-1'),
        document.getElementById('motivation-video-2'),
        document.getElementById('different-video')
    ];
    
    // Add click event listeners to manually play videos if autoplay is blocked
    videos.forEach(video => {
        if (video) {
            // Try to play when user clicks on the video
            video.addEventListener('click', function() {
                this.play().catch(e => console.log('Play prevented:', e));
            });
            
            // Also try to play when user clicks the play button
            // The button is a sibling element, not a child
            const videoContainer = video.closest('.video-container');
            if (videoContainer) {
                const playButton = videoContainer.querySelector('.expand-btn');
                if (playButton) {
                    playButton.addEventListener('click', function(e) {
                        e.stopPropagation();
                        video.play().catch(e => console.log('Play prevented:', e));
                    });
                }
            }
        }
    });
    
    // Auto play videos when they come into view
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Play video when 50% of it is visible
                if (entry.intersectionRatio >= 0.5) {
                    entry.target.play().catch(e => {
                        console.log('Autoplay prevented:', e);
                        // Add visual indicator that user needs to click to play
                        entry.target.setAttribute('title', 'Click to play');
                    });
                }
            } else {
                // Pause video when it's not visible
                entry.target.pause();
            }
        });
    }, {
        threshold: 0.5 // Trigger when 50% of the video is visible
    });
    
    // Observe each video
    videos.forEach(video => {
        if (video) {
            videoObserver.observe(video);
        }
    });
}

// Helper function to check if element is in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Form submission with loading spinner and backend processing
function handleFormSubmit(formId, successMessage) {
    const form = document.getElementById(formId);
    if (!form) return;

    // Check if event listener is already attached
    if (form.dataset.listenerAttached) {
        console.log(`Event listener already attached to ${formId}`);
        return;
    }
    
    form.dataset.listenerAttached = 'true';
    console.log(`Attaching event listener to ${formId}`);

    form.addEventListener('submit', function(e) {
        console.log(`Form ${formId} submission intercepted`);
        e.preventDefault();
        
        // For contact form, do client-side validation first
        if (formId === 'contact-form') {
            console.log('Performing client-side validation for contact form');
            // More robust field value extraction
            const nameField = form.querySelector('#contact-name');
            const emailField = form.querySelector('#contact-email');
            const subjectField = form.querySelector('#subject');
            const messageField = form.querySelector('#contact-message');
            
            // Check if fields exist
            if (!nameField || !emailField || !subjectField || !messageField) {
                alert('Form fields not found. Please refresh the page and try again.');
                return;
            }
            
            // Extract values with extra safety
            const name = nameField.value ? nameField.value.toString().trim() : '';
            const email = emailField.value ? emailField.value.toString().trim() : '';
            const subject = subjectField.value ? subjectField.value.toString().trim() : '';
            const message = messageField.value ? messageField.value.toString().trim() : '';
            
            console.log('Field values extracted:', { name, email, subject, message });
            
            let missingFields = [];
            
            if (!name || name.length === 0) missingFields.push('Name');
            if (!email || email.length === 0) missingFields.push('Email');
            if (!subject || subject.length === 0) missingFields.push('Subject');
            if (!message || message.length === 0) missingFields.push('Message');
            
            if (missingFields.length > 0) {
                console.log('Validation failed: Missing fields:', missingFields);
                alert('Please fill in the following required fields: ' + missingFields.join(', '));
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Please enter a valid email address.');
                return;
            }
            
            // Validate message length
            if (message.length < 10) {
                alert('Message must be at least 10 characters long.');
                return;
            }
            
            if (message.length > 1000) {
                alert('Message must be less than 1000 characters.');
                return;
            }
        }

        console.log('Client-side validation passed');

        // Show loading spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner active';
        spinner.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(spinner);

        // Collect form data and convert to URLSearchParams for proper form encoding
        const formData = new FormData(form);
        const urlParams = new URLSearchParams();
        for (let [key, value] of formData.entries()) {
            urlParams.append(key, value);
        }
        
        console.log('URLSearchParams collected:');
        for (let [key, value] of urlParams.entries()) {
            console.log(`${key}: ${value}`);
        }
        
        // Determine endpoint based on form
        // Use absolute URL to ensure it works correctly when hosted
        let baseUrl = window.location.origin;
        
        // Check if we're on GitHub Pages and use Render.com server instead
        if (window.location.hostname.includes('github.io')) {
            // Use your Render.com server URL for form submissions when hosted on GitHub Pages
            baseUrl = 'https://ankes-lodge.onrender.com';
        }
        
        const endpoint = formId === 'booking-form' ? `${baseUrl}/process-booking` : `${baseUrl}/process-contact`;

        // Send data to backend with proper content type and timeout
        console.log(`Sending data to ${endpoint}`);
        
        // Create AbortController for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // Increase to 30 seconds
        
        fetch(endpoint, {
            method: 'POST',
            body: urlParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            console.log(`Received response: ${response.status} ${response.statusText}`);
            // Check if response is ok before parsing JSON
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Hide spinner
            spinner.remove();
            
            // Show success or error message
            if (data.status === 'success') {
                if (formId === 'booking-form') {
                    // Redirect to confirmation page with booking details
                    const name = form.querySelector('#name').value;
                    const checkin = form.querySelector('#checkin').value;
                    const checkout = form.querySelector('#checkout').value;
                    const roomType = form.querySelector('#room-type').value;
                    
                    window.location.href = `booking-confirmation.html?id=${data.bookingId}&name=${encodeURIComponent(name)}&checkin=${checkin}&checkout=${checkout}&room=${roomType}`;
                } else {
                    alert(data.message);
                    form.reset();
                }
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            // Hide spinner
            spinner.remove();
            
            // Show more detailed error message
            console.error('Error:', error);
            if (error instanceof TypeError && error.message.includes('fetch')) {
                alert('Network error: Failed to connect to server. Please check your internet connection and try again.');
            } else if (error.name === 'AbortError') {
                alert('Request timeout: The server is taking too long to respond. Please try again later.');
            } else if (error.message.includes('HTTP error')) {
                alert('Server error: ' + error.message + '. Please try again later.');
            } else {
                alert('Network error: Failed to submit form. Please try again later.\n\nError details: ' + error.message);
            }
        });
    });
}

// Flyer preview functionality
function initFlyerPreview() {
    const previewBtn = document.getElementById('preview-flyer');
    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            // Create modal for flyer preview
            const flyerModal = document.createElement('div');
            flyerModal.className = 'image-modal';
            const flyerModalContent = document.createElement('div');
            flyerModalContent.className = 'image-modal-content';
            const flyerImg = document.createElement('img');
            flyerImg.src = 'DownloadableFlyer.jpeg';
            
            // Create download button for the preview modal
            const downloadBtn = document.createElement('a');
            downloadBtn.href = 'DownloadableFlyer.jpeg';
            downloadBtn.download = 'Ankes-Lodge-Flyer.jpeg';
            downloadBtn.className = 'btn-secondary';
            downloadBtn.textContent = 'Download Flyer';
            downloadBtn.style.marginTop = '15px';
            downloadBtn.style.marginBottom = '15px';
            downloadBtn.style.alignSelf = 'center';
            
            const closeFlyerModalBtn = document.createElement('button');
            closeFlyerModalBtn.className = 'close-modal-btn';
            closeFlyerModalBtn.innerHTML = '&times;';
            
            flyerModalContent.appendChild(flyerImg);
            flyerModalContent.appendChild(downloadBtn); // Add download button to modal
            flyerModalContent.appendChild(closeFlyerModalBtn);
            flyerModal.appendChild(flyerModalContent);
            document.body.appendChild(flyerModal);
            
            flyerModal.style.display = 'flex';
            
            // Close modal functionality
            closeFlyerModalBtn.addEventListener('click', function() {
                flyerModal.style.display = 'none';
                flyerModal.remove();
            });
            
            flyerModal.addEventListener('click', function(e) {
                if (e.target === flyerModal) {
                    flyerModal.style.display = 'none';
                    flyerModal.remove();
                }
            });
        });
    }
}

// Old testimonial slider functionality removed

// Initialize visitor counter
function initVisitorCounter() {
    // Determine the correct base URL (Render.com when on GitHub Pages)
    let baseUrl = window.location.origin;
    
    // Check if we're on GitHub Pages and use Render.com server instead
    if (window.location.hostname.includes('github.io')) {
        // Use your Render.com server URL for form submissions when hosted on GitHub Pages
        baseUrl = 'https://ankes-lodge.onrender.com'; // Replace with your actual Render.com URL
    }
    
    fetch(`${baseUrl}/visitor-count`)
        .then(response => response.json())
        .then(data => {
            const counterElement = document.getElementById('visitor-count');
            if (counterElement) {
                counterElement.textContent = data.count.toLocaleString();
            }
        })
        .catch(error => {
            console.error('Error fetching visitor count:', error);
        });
}

// Testimonial marquee functionality
function initTestimonialMarquee() {
    const marqueeContainer = document.querySelector('.testimonial-marquee');
    if (!marqueeContainer) return;
    
    // Add event listeners to pause/resume animation on hover/click
    marqueeContainer.addEventListener('mouseenter', function() {
        this.style.animationPlayState = 'paused';
    });
    
    marqueeContainer.addEventListener('mouseleave', function() {
        this.style.animationPlayState = 'running';
    });
    
    marqueeContainer.addEventListener('touchstart', function() {
        this.style.animationPlayState = 'paused';
    });
    
    marqueeContainer.addEventListener('touchend', function() {
        // Resume after a short delay to allow user to read
        setTimeout(() => {
            this.style.animationPlayState = 'running';
        }, 3000);
    });
    
    // Determine the correct base URL (Render.com when on GitHub Pages)
    let baseUrl = window.location.origin;
    
    // Check if we're on GitHub Pages and use Render.com server instead
    if (window.location.hostname.includes('github.io')) {
        // Use your Render.com server URL for form submissions when hosted on GitHub Pages
        baseUrl = 'https://ankes-lodge.onrender.com'; // Replace with your actual Render.com URL
    }
    
    // Fetch testimonials from server
    fetch(`${baseUrl}/testimonials.json`)
        .then(response => response.json())
        .then(testimonials => {
            renderMarqueeTestimonials(testimonials);
        })
        .catch(error => {
            console.error('Error fetching testimonials:', error);
            // Use default testimonials if fetch fails
            const defaultTestimonials = [
                {
                    name: "Samuel K.",
                    location: "Kumasi, Ghana",
                    comment: "Ankes Lodge provided the perfect retreat for our family vacation. The staff was incredibly welcoming and the facilities were spotless.",
                    rating: 5,
                    date: "2025-11-15"
                },
                {
                    name: "Grace A.",
                    location: "Accra, Ghana",
                    comment: "As a business traveler, I appreciate the quiet environment and reliable WiFi. The executive room exceeded my expectations.",
                    rating: 5,
                    date: "2025-10-22"
                },
                {
                    name: "Michael T.",
                    location: "Tech Solutions Ltd",
                    comment: "The full house booking was perfect for our company retreat. The event hall and accommodation made our planning stress-free.",
                    rating: 5,
                    date: "2025-09-30"
                }
            ];
            renderMarqueeTestimonials(defaultTestimonials);
        });

    function renderMarqueeTestimonials(testimonials) {
        const marqueeContainer = document.querySelector('.testimonial-marquee');
        if (!marqueeContainer) return;
        
        // Clear existing content
        marqueeContainer.innerHTML = '';
        
        // Create testimonial cards for marquee
        testimonials.forEach(testimonial => {
            // Create star rating
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += `<span class="star">${i <= testimonial.rating ? '★' : '☆'}</span>`;
            }
            
            // Create testimonial card
            const card = document.createElement('div');
            card.className = 'testimonial-card';
            card.innerHTML = `
                <div class="testimonial-rating">
                    ${stars}
                </div>
                <div class="testimonial-content">
                    <p>"${testimonial.comment}"</p>
                </div>
                <div class="testimonial-author">
                    <h4>${testimonial.name}</h4>
                    <p>${testimonial.location || 'Guest'} • ${testimonial.date}</p>
                </div>
            `;
            
            marqueeContainer.appendChild(card);
        });
        
        // Duplicate testimonials for continuous scrolling effect
        testimonials.forEach(testimonial => {
            // Create star rating
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                stars += `<span class="star">${i <= testimonial.rating ? '★' : '☆'}</span>`;
            }
            
            // Create duplicate testimonial card
            const card = document.createElement('div');
            card.className = 'testimonial-card';
            card.innerHTML = `
                <div class="testimonial-rating">
                    ${stars}
                </div>
                <div class="testimonial-content">
                    <p>"${testimonial.comment}"</p>
                </div>
                <div class="testimonial-author">
                    <h4>${testimonial.name}</h4>
                    <p>${testimonial.location || 'Guest'} • ${testimonial.date}</p>
                </div>
            `;
            
            marqueeContainer.appendChild(card);
        });
    }
}

// Initialize visitor counter
document.addEventListener('DOMContentLoaded', function() {
    // Initialize testimonial marquee
    initTestimonialMarquee();
    
    // Initialize visitor counter
    initVisitorCounter();
    
    // Initialize testimonial form
    initTestimonialForm();
});

// Scroll to top functionality
document.addEventListener('DOMContentLoaded', function() {
    const scrollToTopButton = document.getElementById('scrollToTop');
    
    // Check if the button exists
    if (scrollToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollToTopButton.classList.add('visible');
            } else {
                scrollToTopButton.classList.remove('visible');
            }
        });

        scrollToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
});

// Testimonial form functionality
function initTestimonialForm() {
    const form = document.getElementById('testimonial-form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const name = document.getElementById('testimonial-name').value;
        const location = document.getElementById('testimonial-location').value;
        const rating = document.getElementById('testimonial-rating').value;
        const comment = document.getElementById('testimonial-comment').value;
        
        // Validate form
        if (!name || !rating || !comment) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Create loading spinner
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Submitting...';
        submitButton.disabled = true;
        
        // Submit testimonial
        // Determine the correct base URL (Render.com when on GitHub Pages)
        let baseUrl = window.location.origin;
        
        // Check if we're on GitHub Pages and use Render.com server instead
        if (window.location.hostname.includes('github.io')) {
            // Use your Render.com server URL for form submissions when hosted on GitHub Pages
            baseUrl = 'https://ankes-lodge.onrender.com'; // Replace with your actual Render.com URL
        }
        
        fetch(`${baseUrl}/add-testimonial`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                location: location,
                rating: rating,
                comment: comment
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(data.message);
                form.reset();
                
                // Refresh testimonials
                // Determine the correct base URL (Render.com when on GitHub Pages)
                let baseUrl = window.location.origin;
                
                // Check if we're on GitHub Pages and use Render.com server instead
                if (window.location.hostname.includes('github.io')) {
                    // Use your Render.com server URL for form submissions when hosted on GitHub Pages
                    baseUrl = 'https://ankes-lodge.onrender.com';
                }
                
                fetch(`${baseUrl}/testimonials.json`)
                    .then(response => response.json())
                    .then(testimonials => {
                        const marquee = document.querySelector('.testimonial-marquee');
                        if (marquee) {
                            // Reinitialize marquee with new testimonials
                            initTestimonialMarquee();
                        }
                    });

            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error submitting testimonial:', error);
            alert('Failed to submit testimonial. Please try again later.');
        })
        .finally(() => {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        });
    });
}

// Initialize visitor counter
document.addEventListener('DOMContentLoaded', function() {
    // Initialize testimonial marquee
    initTestimonialMarquee();
    
    // Initialize visitor counter
    initVisitorCounter();
    
    // Initialize testimonial form
    initTestimonialForm();
});

// Apply to both forms
document.addEventListener('DOMContentLoaded', function() {
    handleFormSubmit('booking-form', 'Thank you for your booking request! We will contact you shortly to confirm your reservation.');
    handleFormSubmit('contact-form', 'Thank you for your message! We will get back to you soon.');
});