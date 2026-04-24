const axios = require('axios');

async function testSyncNews() {
  try {
    const response = await axios.post('http://localhost:3000/wordpress/sync-news');
    console.log('Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testSyncNews();
