const axios = require('axios');

async function testGetNews() {
  try {
    const response = await axios.get('http://localhost:3000/scraper/news');
    console.log(`Success! Found ${response.data.length} news items.`);
    if (response.data.length > 0) {
        console.log('--- First News Item ---');
        const first = response.data[0];
        console.log(`ID: ${first.id}`);
        console.log(`Name: ${first.name}`);
        console.log(`URL: ${first.url}`);
        console.log(`Category: ${first.category}`);
        console.log(`Rank Math Title: ${first.rankMathTitle}`);
        console.log(`Description Snippet: ${first.fullDescription ? first.fullDescription.substring(0, 100) + '...' : ''}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGetNews();
