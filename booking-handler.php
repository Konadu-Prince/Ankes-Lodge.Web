<?php
// Set content type to JSON
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $name = isset($_POST['name']) ? htmlspecialchars($_POST['name']) : '';
    $email = isset($_POST['email']) ? htmlspecialchars($_POST['email']) : '';
    $phone = isset($_POST['phone']) ? htmlspecialchars($_POST['phone']) : '';
    $checkin = isset($_POST['checkin']) ? htmlspecialchars($_POST['checkin']) : '';
    $checkout = isset($_POST['checkout']) ? htmlspecialchars($_POST['checkout']) : '';
    $adults = isset($_POST['adults']) ? htmlspecialchars($_POST['adults']) : '';
    $children = isset($_POST['children']) ? htmlspecialchars($_POST['children']) : '';
    $roomType = isset($_POST['room-type']) ? htmlspecialchars($_POST['room-type']) : '';
    $message = isset($_POST['message']) ? htmlspecialchars($_POST['message']) : '';
    
    // Validate required fields
    if (empty($name) || empty($email) || empty($phone) || empty($checkin) || empty($checkout) || empty($roomType)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }
    
    // Create booking record
    $booking = [
        'id' => uniqid(),
        'timestamp' => date('Y-m-d H:i:s'),
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'checkin' => $checkin,
        'checkout' => $checkout,
        'adults' => $adults,
        'children' => $children,
        'roomType' => $roomType,
        'message' => $message
    ];
    
    // Save to JSON file
    $bookingsFile = 'bookings.json';
    if (file_exists($bookingsFile)) {
        $bookings = json_decode(file_get_contents($bookingsFile), true);
        if (!is_array($bookings)) {
            $bookings = [];
        }
    } else {
        $bookings = [];
    }
    
    $bookings[] = $booking;
    
    // Try to save the bookings
    if (file_put_contents($bookingsFile, json_encode($bookings, JSON_PRETTY_PRINT))) {
        // Send email notification
        $to = "konaduprince@gmail.com";
        $subject = "New Booking Request from Ankes Lodge Website";
        $body = "New Booking Request:\n\n";
        $body .= "Name: $name\n";
        $body .= "Email: $email\n";
        $body .= "Phone: $phone\n";
        $body .= "Check-in Date: $checkin\n";
        $body .= "Check-out Date: $checkout\n";
        $body .= "Adults: $adults\n";
        $body .= "Children: $children\n";
        $body .= "Room Type: $roomType\n";
        $body .= "Special Requests: $message\n";
        $body .= "Timestamp: " . date('Y-m-d H:i:s') . "\n";
        
        $headers = "From: $email\r\n";
        $headers .= "Reply-To: $email\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();
        
        // Try to send email
        $emailSent = mail($to, $subject, $body, $headers);
        
        if ($emailSent) {
            echo json_encode(['status' => 'success', 'message' => 'Booking request submitted successfully! We will contact you shortly to confirm your reservation.']);
        } else {
            // Still success for the user, but log the email issue
            echo json_encode(['status' => 'success', 'message' => 'Booking request submitted successfully! We will contact you shortly to confirm your reservation. (Note: Email notification failed)']);
        }
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to save booking. Please try again later.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>