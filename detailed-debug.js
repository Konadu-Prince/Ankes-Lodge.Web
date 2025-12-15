const express = require('express');
const { body, validationResult } = require('express-validator');
const fs = require('fs');

// Test the validation rules individually
async function testValidations() {
    console.log('Testing validation rules...\n');
    
    // Test data that should pass all validations
    const validData = {
        name: 'John Doe',
        email: 'johndoe@example.com',
        phone: '0544904547', // Valid Ghana phone format
        checkin: '2025-12-01',
        checkout: '2025-12-05',
        adults: '2',
        children: '1',
        'room-type': 'executive',
        message: 'Test booking for debugging purposes'
    };
    
    // Test each validation rule
    const validationRules = [
        body('name').trim().escape().isLength({ min: 2, max: 50 }),
        body('email').trim().normalizeEmail().isEmail(),
        body('phone').trim().escape().matches(/^(?:\+233|0)(?:20|50|24|54|27|57|26|56|23|28)\d{7}$/),
        body('checkin').isISO8601(),
        body('checkout').isISO8601(),
        body('adults').isInt({ min: 1, max: 10 }),
        body('children').isInt({ min: 0, max: 10 }),
        body('message').trim().escape().isLength({ max: 500 })
    ];
    
    // Create a mock request object
    const mockReq = {
        body: validData
    };
    
    // Apply validations
    for (const rule of validationRules) {
        await rule(mockReq, {}, () => {});
    }
    
    // Check results
    const errors = validationResult(mockReq);
    if (!errors.isEmpty()) {
        console.log('Validation errors found:');
        errors.array().forEach(error => {
            console.log(`- ${error.param}: ${error.msg}`);
        });
    } else {
        console.log('All validations passed!');
    }
    
    // Test with invalid data to see error messages
    console.log('\n--- Testing with invalid data ---');
    const invalidData = {
        name: 'J', // Too short
        email: 'invalid-email', // Invalid format
        phone: '1234567890', // Invalid format
        checkin: 'invalid-date',
        checkout: 'invalid-date',
        adults: '0', // Less than minimum
        children: '-1', // Less than minimum
        'room-type': 'invalid-room',
        message: 'A'.repeat(600) // Too long
    };
    
    const mockReqInvalid = {
        body: invalidData
    };
    
    // Apply validations to invalid data
    for (const rule of validationRules) {
        await rule(mockReqInvalid, {}, () => {});
    }
    
    // Check results for invalid data
    const invalidErrors = validationResult(mockReqInvalid);
    if (!invalidErrors.isEmpty()) {
        console.log('Validation errors with invalid data:');
        invalidErrors.array().forEach(error => {
            console.log(`- ${error.param}: ${error.msg}`);
        });
    }
}

// Test the complete booking process
async function testCompleteBooking() {
    console.log('\n--- Testing complete booking process ---');
    
    // Simulate what the frontend sends
    const formData = new URLSearchParams({
        name: 'John Doe',
        email: 'johndoe@example.com',
        phone: '0544904547',
        checkin: '2025-12-01',
        checkout: '2025-12-05',
        adults: '2',
        children: '1',
        'room-type': 'executive',
        message: 'Test booking for debugging purposes'
    });
    
    console.log('Form data being sent:');
    console.log(Object.fromEntries(formData));
}

testValidations();
testCompleteBooking();