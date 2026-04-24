const axios = require('axios');

async function testTrigger() {
  try {
    const response = await axios.post('http://localhost:3000/scraper/trigger-news', {
      targetUrl: 'https://3em.vn/quy-trinh-san-xuat'
    });
    console.log('Success:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Response:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testTrigger();
