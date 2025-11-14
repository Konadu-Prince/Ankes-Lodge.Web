from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
import os
from datetime import datetime
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class BookingHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Get the content length
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        # Parse form data
        parsed_data = urllib.parse.parse_qs(post_data.decode('utf-8'))
        
        # Convert to simple dict
        form_data = {key: value[0] if value else '' for key, value in parsed_data.items()}
        
        # Handle booking form
        if self.path == '/process-booking':
            self.handle_booking(form_data)
        # Handle contact form
        elif self.path == '/process-contact':
            self.handle_contact(form_data)
        else:
            self.send_error(404)
    
    def send_email_notification(self, subject, body, recipient_email):
        """Send email notification using Gmail SMTP with App Password
        
        NOTE: For this to work with Gmail, you need to:
        1. Enable 2-Factor Authentication on your Google account
        2. Generate an App Password at https://myaccount.google.com/apppasswords
        3. Use the App Password instead of your regular Gmail password
        
        If you get authentication errors, the system will fall back to console logging.
        """
        try:
            # Gmail SMTP configuration
            smtp_server = "smtp.gmail.com"
            smtp_port = 587
            sender_email = "konaduprince@gmail.com"
            # IMPORTANT: This should be a Google App Password, not your regular Gmail password
            sender_password = "uvyvtipfnavvkwwr"  # Google App Password
            
            # Create message
            message = MIMEMultipart()
            message["From"] = sender_email
            message["To"] = recipient_email
            message["Subject"] = subject
            message.attach(MIMEText(body, "plain"))
            
            # Create SMTP session
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.set_debuglevel(1)  # Enable debug output
            server.starttls()  # Enable TLS encryption
            server.login(sender_email, sender_password)
            
            # Send email
            text = message.as_string()
            server.sendmail(sender_email, recipient_email, text)
            server.quit()
            
            print(f"EMAIL SENT SUCCESSFULLY:")
            print(f"To: {recipient_email}")
            print(f"Subject: {subject}")
            print("---")
            return True
        except smtplib.SMTPAuthenticationError as e:
            print(f"EMAIL AUTHENTICATION FAILED: {e}")
            print("Please check that you're using a Google App Password, not your regular Gmail password")
            # Fallback to console logging
            print(f"EMAIL NOTIFICATION (FALLBACK):")
            print(f"To: {recipient_email}")
            print(f"Subject: {subject}")
            print(f"Body: {body}")
            print("---")
            return False
        except smtplib.SMTPException as e:
            print(f"EMAIL SMTP ERROR: {e}")
            # Fallback to console logging
            print(f"EMAIL NOTIFICATION (FALLBACK):")
            print(f"To: {recipient_email}")
            print(f"Subject: {subject}")
            print(f"Body: {body}")
            print("---")
            return False
        except Exception as e:
            print(f"EMAIL SENDING FAILED: {e}")
            # Fallback to console logging
            print(f"EMAIL NOTIFICATION (FALLBACK):")
            print(f"To: {recipient_email}")
            print(f"Subject: {subject}")
            print(f"Body: {body}")
            print("---")
            return False
    
    def handle_booking(self, form_data):
        # Validate required fields
        required_fields = ['name', 'email', 'phone', 'checkin', 'checkout', 'room-type']
        for field in required_fields:
            if not form_data.get(field):
                self.send_json_response({'status': 'error', 'message': f'Please fill in all required fields. Missing: {field}'})
                return
        
        # Create booking record
        booking = {
            'id': str(uuid.uuid4())[:8],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'name': form_data.get('name', ''),
            'email': form_data.get('email', ''),
            'phone': form_data.get('phone', ''),
            'checkin': form_data.get('checkin', ''),
            'checkout': form_data.get('checkout', ''),
            'adults': form_data.get('adults', ''),
            'children': form_data.get('children', ''),
            'roomType': form_data.get('room-type', ''),
            'message': form_data.get('message', '')
        }
        
        # Save to JSON file
        bookings_file = 'bookings.json'
        try:
            if os.path.exists(bookings_file):
                with open(bookings_file, 'r') as f:
                    bookings = json.load(f)
            else:
                bookings = []
            
            bookings.append(booking)
            
            with open(bookings_file, 'w') as f:
                json.dump(bookings, f, indent=2)
            
            # Send email notification
            email_subject = "New Booking Request from Ankes Lodge Website"
            email_body = f"""
New Booking Request:

Name: {booking['name']}
Email: {booking['email']}
Phone: {booking['phone']}
Check-in Date: {booking['checkin']}
Check-out Date: {booking['checkout']}
Adults: {booking['adults']}
Children: {booking['children']}
Room Type: {booking['roomType']}
Special Requests: {booking['message']}
Timestamp: {booking['timestamp']}
            """
            
            email_sent = self.send_email_notification(email_subject, email_body, "konaduprince@gmail.com")
            
            if email_sent:
                self.send_json_response({'status': 'success', 'message': 'Booking request submitted successfully! We will contact you shortly to confirm your reservation.'})
            else:
                self.send_json_response({'status': 'success', 'message': 'Booking request submitted successfully! We will contact you shortly to confirm your reservation. (Note: Email notification failed)'})
        except Exception as e:
            self.send_json_response({'status': 'error', 'message': f'Failed to save booking: {str(e)}'})
    
    def handle_contact(self, form_data):
        # Validate required fields
        required_fields = ['contact-name', 'contact-email', 'subject', 'contact-message']
        for field in required_fields:
            if not form_data.get(field):
                self.send_json_response({'status': 'error', 'message': f'Please fill in all required fields. Missing: {field}'})
                return
        
        # Create contact record
        contact = {
            'id': str(uuid.uuid4())[:8],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'name': form_data.get('contact-name', ''),
            'email': form_data.get('contact-email', ''),
            'subject': form_data.get('subject', ''),
            'message': form_data.get('contact-message', '')
        }
        
        # Save to JSON file
        contacts_file = 'contacts.json'
        try:
            if os.path.exists(contacts_file):
                with open(contacts_file, 'r') as f:
                    contacts = json.load(f)
            else:
                contacts = []
            
            contacts.append(contact)
            
            with open(contacts_file, 'w') as f:
                json.dump(contacts, f, indent=2)
            
            # Send email notification
            email_subject = f"Contact Form: {contact['subject']}"
            email_body = f"""
New Contact Form Submission:

Name: {contact['name']}
Email: {contact['email']}
Subject: {contact['subject']}
Message: {contact['message']}
Timestamp: {contact['timestamp']}
            """
            
            email_sent = self.send_email_notification(email_subject, email_body, "konaduprince@gmail.com")
            
            if email_sent:
                self.send_json_response({'status': 'success', 'message': 'Thank you for your message! We will get back to you soon.'})
            else:
                self.send_json_response({'status': 'success', 'message': 'Thank you for your message! We will get back to you soon. (Note: Email notification failed)'})
        except Exception as e:
            self.send_json_response({'status': 'error', 'message': f'Failed to save message: {str(e)}'})
    
    def send_json_response(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def do_GET(self):
        # Serve static files
        if self.path == '/':
            self.path = '/index.html'
        
        # Serve bookings.json and contacts.json
        if self.path in ['/bookings.json', '/contacts.json']:
            if os.path.exists('.' + self.path):
                with open('.' + self.path, 'r') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            else:
                self.send_error(404)
            return
        
        # Serve other static files
        try:
            with open('.' + self.path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            if self.path.endswith('.html'):
                self.send_header('Content-type', 'text/html')
            elif self.path.endswith('.css'):
                self.send_header('Content-type', 'text/css')
            elif self.path.endswith('.js'):
                self.send_header('Content-type', 'application/javascript')
            elif self.path.endswith('.json'):
                self.send_header('Content-type', 'application/json')
            elif self.path.endswith('.jpg') or self.path.endswith('.jpeg'):
                self.send_header('Content-type', 'image/jpeg')
            elif self.path.endswith('.png'):
                self.send_header('Content-type', 'image/png')
            elif self.path.endswith('.mp4'):
                self.send_header('Content-type', 'video/mp4')
            else:
                self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404)

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8000), BookingHandler)
    print('Server running at http://localhost:8000')
    print('NOTE: For Gmail email notifications to work, you need to:')
    print('1. Enable 2-Factor Authentication on your Google account')
    print('2. Generate an App Password at https://myaccount.google.com/apppasswords')
    print('3. Replace the password in the code with your App Password')
    print('If email fails, notifications will be logged to the console.')
    server.serve_forever()