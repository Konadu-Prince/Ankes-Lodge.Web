<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $name = htmlspecialchars($_POST['name']);
    $email = htmlspecialchars($_POST['email']);
    $phone = htmlspecialchars($_POST['phone']);
    $checkin = htmlspecialchars($_POST['checkin']);
    $checkout = htmlspecialchars($_POST['checkout']);
    $adults = htmlspecialchars($_POST['adults']);
    $children = htmlspecialchars($_POST['children']);
    $roomType = htmlspecialchars($_POST['room-type']);
    $message = htmlspecialchars($_POST['message']);
    
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
    } else {
        $bookings = [];
    }
    
    $bookings[] = $booking;
    file_put_contents($bookingsFile, json_encode($bookings, JSON_PRETTY_PRINT));
    
    // Email configuration
    $to = "reservations@ankeslodge.com";
    $subject = "New Booking Request from Ankes Lodge Website";
    
    // Create email body
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
    
    // Send email
    $headers = "From: $email";
    
    if (mail($to, $subject, $body, $headers)) {
        // Redirect to thank you page or send JSON response
        echo json_encode(['status' => 'success', 'message' => 'Booking request submitted successfully!']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to send booking request.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>