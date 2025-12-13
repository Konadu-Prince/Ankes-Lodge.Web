const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testVisitorCount() {
    try {
        const response = await fetch('http://localhost:8000/visitor-count');
        const result = await response.json();
        console.log('Visitor count response:', result);
    } catch (error) {
        console.error('Error testing visitor count:', error);
    }
}

testVisitorCount();