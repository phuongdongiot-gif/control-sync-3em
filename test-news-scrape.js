const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeNews() {
  const url = 'https://3em.vn/quy-trinh-san-xuat';
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);
  
  const articles = [];
  // Try common selectors for news lists
  $('.blog-list .blog-item').each((i, el) => {
      articles.push($(el).html());
  });
  if (articles.length === 0) {
      $('.article-item').each((i, el) => {
          articles.push($(el).html());
      });
  }
  if (articles.length === 0) {
      $('.post-item').each((i, el) => {
          articles.push($(el).html());
      });
  }
  if (articles.length === 0) {
      $('.news-item').each((i, el) => {
          articles.push($(el).html());
      });
  }
  if (articles.length === 0) {
    $('.item_blog_base').each((i, el) => {
          articles.push($(el).html());
      });
  }
  
  if (articles.length === 0) {
      console.log("Could not find article items. Dumping first 1000 characters of HTML to find the selector.");
      console.log(html.substring(0, 1000));
      // Dump the whole body text to see what class we might need
      const mainContent = $('main').html() || $('#main').html() || $('.main-content').html() || $('body').html();
      const fs = require('fs');
      fs.writeFileSync('temp-html.html', mainContent);
      console.log("Wrote main content to temp-html.html");
  } else {
      console.log("Found " + articles.length + " articles.");
      console.log("First article HTML:");
      console.log(articles[0]);
  }
}

scrapeNews().catch(console.error);
