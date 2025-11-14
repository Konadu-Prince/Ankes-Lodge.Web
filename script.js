// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// Set minimum check-in date to today
const today = new Date().toISOString().split('T')[0];
document.getElementById('checkin').setAttribute('min', today);

// Set minimum check-out date based on check-in date
document.getElementById('checkin').addEventListener('change', function() {
    const checkinDate = new Date(this.value);
    const minCheckout = new Date(checkinDate);
    minCheckout.setDate(minCheckout.getDate() + 1);
    const minCheckoutStr = minCheckout.toISOString().split('T')[0];
    document.getElementById('checkout').setAttribute('min', minCheckoutStr);
    
    // Auto-set checkout date to next day if not already set
    if (!document.getElementById('checkout').value || new Date(document.getElementById('checkout').value) <= checkinDate) {
        document.getElementById('checkout').value = minCheckoutStr;
    }
});

// Handle room booking buttons
document.querySelectorAll('.book-room').forEach(button => {
    button.addEventListener('click', function() {
        const roomType = this.getAttribute('data-room');
        document.getElementById('room-type').value = roomType;
        
        // Scroll to booking section
        document.querySelector('#booking').scrollIntoView({ behavior: 'smooth' });
        
        // Highlight the booking section
        document.getElementById('booking').style.backgroundColor = '#fff8e6';
        setTimeout(() => {
            document.getElementById('booking').style.backgroundColor = '';
        }, 2000);
    });
});

// Helper function to get room type name
function getRoomTypeName(roomType) {
    switch(roomType) {
        case 'executive':
            return 'Executive Room';
        case 'regular':
            return 'Regular Bedroom';
        case 'full-house':
            return 'Full House';
        default:
            return 'Room';
    }
}

// Video player is now embedded directly in the HTML
// No additional JavaScript needed for video playback

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default for check-in
    document.getElementById('checkin').value = today;
    
    // Set tomorrow's date as default for check-out
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('checkout').value = tomorrow.toISOString().split('T')[0];
    
    // Scroll to top functionality
    const scrollToTopButton = document.getElementById('scrollToTop');
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopButton.classList.add('visible');
        } else {
            scrollToTopButton.classList.remove('visible');
        }
    });
    
    scrollToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});

// Video functionality
document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('gallery-video');
    const expandBtn = document.querySelector('.expand-video-btn');
    const videoModal = document.createElement('div');
    const modalContent = document.createElement('div');
    const closeModalBtn = document.createElement('button');
    const modalVideo = document.createElement('video');
    
    // Create modal structure
    videoModal.className = 'video-modal';
    modalContent.className = 'video-modal-content';
    closeModalBtn.className = 'close-modal-btn';
    closeModalBtn.innerHTML = '&times;';
    modalVideo.controls = true;
    modalVideo.innerHTML = '<source src="videoOftheroomsAndEverything.mp4" type="video/mp4">Your browser does not support the video tag.';
    
    modalContent.appendChild(modalVideo);
    modalContent.appendChild(closeModalBtn);
    videoModal.appendChild(modalContent);
    document.body.appendChild(videoModal);
    
    // Expand video to modal
    expandBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        videoModal.style.display = 'flex';
        // Play the modal video
        modalVideo.play();
    });
    
    // Close modal
    closeModalBtn.addEventListener('click', function() {
        videoModal.style.display = 'none';
        modalVideo.pause();
        modalVideo.currentTime = 0;
    });
    
    // Close modal when clicking outside
    videoModal.addEventListener('click', function(e) {
        if (e.target === videoModal) {
            videoModal.style.display = 'none';
            modalVideo.pause();
            modalVideo.currentTime = 0;
        }
    });
    
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
});

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