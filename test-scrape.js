const cheerio = require('cheerio');

async function testSingle() {
  const url = 'https://3em.vn/la-chuoi-plastic';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  console.log('length of .rte:', $('.rte').length);
  console.log('length of #tab-description:', $('#tab-description').length);
  
  const htmlContent = $('#tab-description').html();
  const index = htmlContent ? htmlContent.indexOf('<img') : -1;
  const index2 = htmlContent ? htmlContent.indexOf('<iframe') : -1;
  const index3 = htmlContent ? htmlContent.indexOf('<video') : -1;

  console.log('indexOf img:', index);
  console.log('indexOf iframe:', index2);
  console.log('indexOf video:', index3);

  // let's grab all attributes of tags inside tab-description
  $('#tab-description img').each((i, el) => console.log('IMG:', $(el).attr('src')));
  $('#tab-description iframe').each((i, el) => console.log('IFRAME:', $(el).attr('src')));

  // Let's specifically look for YouTube links or MP4 links anywhere in the doc
  console.log('Has youtube in html?', html.includes('youtube'));
  console.log('Has mp4 in html?', html.includes('.mp4'));
}

testSingle();
