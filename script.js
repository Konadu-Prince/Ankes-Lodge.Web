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
    button.addEventListener('click', function() {
        const roomType = this.getAttribute('data-room');
        const roomSelect = document.getElementById('room-type');
        roomSelect.value = roomType;
        
        // Scroll to booking section
        document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
        
        // Highlight the booking section
        document.getElementById('booking').style.animation = 'highlight 2s';
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
});

// Scroll to top functionality
const scrollToTopButton = document.getElementById('scrollToTop');
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        scrollToTopButton.style.display = 'block';
    } else {
        scrollToTopButton.style.display = 'none';
    }
});

scrollToTopButton.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
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
    modalVideo.innerHTML = '<source src="videoOftheroomsAndEverything.mp4" type="video/mp4">Your browser does not support the video tag.';
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
    
    // Handle expand button click for video
    document.querySelector('.video-container .expand-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        videoModal.style.display = 'flex';
        // Pause the main video when expanding
        const mainVideo = document.getElementById('gallery-video');
        mainVideo.pause();
        // Play the modal video
        modalVideo.play();
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
        // Resume main video if it was playing
        const mainVideo = document.getElementById('gallery-video');
        const videoContainer = document.querySelector('.video-container');
        const isVideoVisible = isElementInViewport(videoContainer);
        if (isVideoVisible) {
            mainVideo.play().catch(e => console.log('Autoplay prevented:', e));
        }
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
            // Resume main video if it was playing
            const mainVideo = document.getElementById('gallery-video');
            const videoContainer = document.querySelector('.video-container');
            const isVideoVisible = isElementInViewport(videoContainer);
            if (isVideoVisible) {
                mainVideo.play().catch(e => console.log('Autoplay prevented:', e));
            }
        }
    });
}

// Video autoplay functionality
function initVideoAutoplay() {
    const video = document.getElementById('gallery-video');
    
    // Auto play video when it comes into view
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Play video when 50% of it is visible
                if (entry.intersectionRatio >= 0.5) {
                    video.play().catch(e => console.log('Autoplay prevented:', e));
                }
            } else {
                // Pause video when it's not visible
                video.pause();
            }
        });
    }, {
        threshold: 0.5 // Trigger when 50% of the video is visible
    });
    
    videoObserver.observe(video);
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

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Show loading spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner active';
        spinner.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(spinner);

        // Collect form data
        const formData = new FormData(form);
        
        // Determine endpoint based on form
        const endpoint = formId === 'booking-form' ? '/process-booking' : '/process-contact';

        // Send data to backend
        fetch(endpoint, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Hide spinner
            spinner.remove();
            
            // Show success or error message
            if (data.status === 'success') {
                alert(data.message);
                form.reset();
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            // Hide spinner
            spinner.remove();
            
            // Show error message
            alert('Network error: Failed to submit form. Please try again later.');
            console.error('Error:', error);
        });
    });
}

// Apply to both forms
document.addEventListener('DOMContentLoaded', function() {
    handleFormSubmit('booking-form', 'Thank you for your booking request! We will contact you shortly to confirm your reservation.');
    handleFormSubmit('contact-form', 'Thank you for your message! We will get back to you soon.');
});