<?php
// Set content type to JSON
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $name = isset($_POST['contact-name']) ? htmlspecialchars($_POST['contact-name']) : '';
    $email = isset($_POST['contact-email']) ? htmlspecialchars($_POST['contact-email']) : '';
    $subject = isset($_POST['subject']) ? htmlspecialchars($_POST['subject']) : '';
    $message = isset($_POST['contact-message']) ? htmlspecialchars($_POST['contact-message']) : '';
    
    // Validate required fields
    if (empty($name) || empty($email) || empty($subject) || empty($message)) {
        echo json_encode(['status' => 'error', 'message' => 'Please fill in all required fields.']);
        exit;
    }
    
    // Create contact record
    $contact = [
        'id' => uniqid(),
        'timestamp' => date('Y-m-d H:i:s'),
        'name' => $name,
        'email' => $email,
        'subject' => $subject,
        'message' => $message
    ];
    
    // Save to JSON file
    $contactsFile = 'contacts.json';
    if (file_exists($contactsFile)) {
        $contacts = json_decode(file_get_contents($contactsFile), true);
        if (!is_array($contacts)) {
            $contacts = [];
        }
    } else {
        $contacts = [];
    }
    
    $contacts[] = $contact;
    
    // Try to save the contacts
    if (file_put_contents($contactsFile, json_encode($contacts, JSON_PRETTY_PRINT))) {
        // Send email notification
        $to = "ankeslodge@gmail.com";
        $emailSubject = "Contact Form: $subject";
        $body = "New Contact Form Submission:\n\n";
        $body .= "Name: $name\n";
        $body .= "Email: $email\n";
        $body .= "Subject: $subject\n";
        $body .= "Message: $message\n";
        $body .= "Timestamp: " . date('Y-m-d H:i:s') . "\n";
        
        $headers = "From: $email\r\n";
        $headers .= "Reply-To: $email\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();
        
        // Try to send email
        $emailSent = mail($to, $emailSubject, $body, $headers);
        
        if ($emailSent) {
            echo json_encode(['status' => 'success', 'message' => 'Thank you for your message! We will get back to you soon.']);
        } else {
            // Still success for the user, but log the email issue
            echo json_encode(['status' => 'success', 'message' => 'Thank you for your message! We will get back to you soon. (Note: Email notification failed)']);
        }
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to save message. Please try again later.']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
}
?>