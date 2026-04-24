const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeNewsDetail() {
  const url = 'https://3em.vn/quy-trinh-san-xuat-nuoc-mam';
  const response = await axios.get(url);
  const html = response.data;
  
  // Dump main content to see the structure of a news detail page
  const $ = cheerio.load(html);
  const content = $('article').html() || $('.article-content').html() || $('.post-content').html() || $('main').html() || $('body').html();
  fs.writeFileSync('temp-news-detail.html', content);
  console.log("Wrote detail content to temp-news-detail.html");
}

scrapeNewsDetail().catch(console.error);
