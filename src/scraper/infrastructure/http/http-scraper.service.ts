import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as cheerio from 'cheerio';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class HttpScraperService {
  private readonly logger = new Logger(HttpScraperService.name);

  constructor(private readonly httpService: HttpService) {}

  async fetchCategoryLinks(url: string): Promise<string[]> {
    try {
      const response = await lastValueFrom(this.httpService.get(url, { responseType: 'text' }));
      const $ = cheerio.load(response.data);
      const productLinks: string[] = [];

      $('.product-item').each((i, el) => {
        const link = $(el).find('.product-item__link').attr('href');
        if (link) productLinks.push(link);
      });
      return productLinks;
    } catch (err) {
      this.logger.error('Failed to fetch category link', err);
      throw new Error('Category fetch failed');
    }
  }

  async fetchNewsLinks(url: string): Promise<string[]> {
    try {
      const response = await lastValueFrom(this.httpService.get(url, { responseType: 'text' }));
      const $ = cheerio.load(response.data);
      const newsLinks: string[] = [];

      $('.blog-item').each((i, el) => {
        const link = $(el).find('.blog-item-name a').attr('href') || $(el).find('a').attr('href');
        if (link && !newsLinks.includes(link)) {
            newsLinks.push(link);
        }
      });
      return newsLinks;
    } catch (err) {
      this.logger.error('Failed to fetch news link', err);
      throw new Error('News fetch failed');
    }
  }

  async fetchProductDetail(url: string): Promise<any> {
    try {
      const response = await lastValueFrom(this.httpService.get(url, { responseType: 'text' }));
      const detail$ = cheerio.load(response.data);

      let name = detail$('h1').first().contents().filter((idx, el) => el.type === 'text').text().trim();
      if (!name) name = detail$('h1').first().text().trim();

      let price = detail$('.details-product .price').first().text().trim();
      if (!price) price = detail$('.special-price .price').first().text().trim();
      if (!price) price = detail$('.price-box .price').first().text().trim();
      price = price.replace(/\n+/g, '').replace(/\s{2,}/g, ' ');

      const images: string[] = [];
      const mainImg = detail$('.product-image-feature').attr('src') || detail$('.large-image img').attr('src') || detail$('.image-gallery img').attr('src');
      if (mainImg) images.push(mainImg);

      detail$('.thumb-img img, .thumbnail img, .owl-item img, .swiper-slide img, .product-image-thumbs img').each((idx, el) => {
        const src = detail$(el).attr('data-image') || detail$(el).attr('data-src') || detail$(el).attr('src');
        if (src && !images.includes(src) && !src.includes('logo') && !src.includes('base64')) {
            images.push(src);
        }
      });

      const descContainer = detail$('#tab-description').length ? detail$('#tab-description') : detail$('.rte').first();

      let descriptionText = descContainer.text().trim() || '';
      
      // Xoá toàn bộ chữ ký/footer thông tin liên hệ bằng cách chặt đứt từ khóa mốc
      const stopWords = [
        '✨ Liên hệ', 
        'CÔNG TY TNHH BAO BÌ', 
        'Website: ', 
        'Hotline',
        'Zalo',
        'Ms.Kiều',
        'Mr.Lâm',
        'Viết đánh giá'
      ];
      
      for (const word of stopWords) {
        if (descriptionText.includes(word)) {
          descriptionText = descriptionText.split(word)[0].trim();
        }
      }

      descriptionText = descriptionText.replace(/\n{2,}/g, '\n').replace(/\s{2,}/g, ' ');

      // Cạo sạch sành sanh mọi định dạng Số Điện Thoại dạng 09xxxx (Có chấm, gạch ngang, khoảng trắng hoặc dính liền)
      descriptionText = descriptionText.replace(/09[0-9]{2}[\.\-\s]*[0-9]{3}[\.\-\s]*[0-9]{3}/g, '');
      descriptionText = descriptionText.trim();

      const descriptionVideos: string[] = [];
      descContainer.find('iframe, video').each((idx, el) => {
         const src = detail$(el).attr('src');
         if (src && !descriptionVideos.includes(src)) descriptionVideos.push(src);
      });

      const descriptionImages: string[] = [];
      descContainer.find('img').each((idx, el) => {
         const src = detail$(el).attr('src');
         if (src && !descriptionImages.includes(src) && !images.includes(src)) descriptionImages.push(src);
      });

      let breadcrumbCat = '';
      const breadcrumbItems = detail$('.breadcrumb li, .ul-breadcrumb li');
      if (breadcrumbItems.length >= 2) {
         let potentialCat = detail$(breadcrumbItems[breadcrumbItems.length - 2]).text().trim();
         if (potentialCat && potentialCat.toLowerCase() !== 'trang chủ') {
             breadcrumbCat = potentialCat;
         }
      }

      return { 
        url, 
        name: name || 'N/A', 
        price: price || 'Liên hệ', 
        images, 
        descriptionVideos, 
        descriptionImages, 
        fullDescription: descriptionText,
        category: breadcrumbCat
      };
    } catch (err) {
      this.logger.error(`Failed fetching details for ${url}`, err);
      return null;
    }
  }

  async fetchNewsDetail(url: string): Promise<any> {
    try {
      const response = await lastValueFrom(this.httpService.get(url, { responseType: 'text' }));
      const detail$ = cheerio.load(response.data);

      let name = detail$('h1.title-head').first().text().trim();
      if (!name) name = detail$('h1').first().text().trim();

      const images: string[] = [];
      let mainImg = detail$('.article-image img').attr('src') || detail$('.blog-item-thumbnail img').attr('src');
      if (!mainImg) {
          mainImg = detail$('meta[property="og:image"]').attr('content');
      }
      if (mainImg) images.push(mainImg);

      const descContainer = detail$('.rte').first();

      // Fix relative image URLs before extracting HTML
      descContainer.find('img').each((idx, el) => {
          const src = detail$(el).attr('src');
          if (src && src.startsWith('/')) {
              detail$(el).attr('src', 'https://3em.vn' + src);
          }
      });

      let descriptionHtml = descContainer.html() || '';
      
      const stopWords = [
        '✨ Liên hệ', 
        'CÔNG TY TNHH BAO BÌ', 
        'Website:', 
        'Hotline',
        'Zalo',
        'Ms.Kiều',
        'Mr.Lâm'
      ];

      for (const word of stopWords) {
        if (descriptionHtml.includes(word)) {
          descriptionHtml = descriptionHtml.split(word)[0].trim();
        }
      }

      // Lược bỏ khoảng trắng thừa
      descriptionHtml = descriptionHtml.replace(/\n{2,}/g, '\n').trim();

      const descriptionVideos: string[] = [];
      descContainer.find('iframe, video').each((idx, el) => {
         const src = detail$(el).attr('src');
         if (src && !descriptionVideos.includes(src)) descriptionVideos.push(src);
      });

      const descriptionImages: string[] = [];
      descContainer.find('img').each((idx, el) => {
         const src = detail$(el).attr('src');
         if (src && !descriptionImages.includes(src) && !images.includes(src)) descriptionImages.push(src);
      });

      let breadcrumbCat = 'Quy trình sản xuất'; // Default category for news
      const breadcrumbItems = detail$('.breadcrumb li, .ul-breadcrumb li');
      if (breadcrumbItems.length >= 2) {
         let potentialCat = detail$(breadcrumbItems[breadcrumbItems.length - 2]).text().trim();
         if (potentialCat && potentialCat.toLowerCase() !== 'trang chủ') {
             breadcrumbCat = potentialCat;
         }
      }

      return { 
        url, 
        name: name || 'N/A', 
        price: '0', 
        images, 
        descriptionVideos, 
        descriptionImages, 
        fullDescription: descriptionHtml,
        category: breadcrumbCat
      };
    } catch (err) {
      this.logger.error(`Failed fetching news details for ${url}`, err);
      return null;
    }
  }
}
