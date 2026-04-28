import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as cheerio from 'cheerio';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { Product } from '../../scraper/domain/models/product.model';
import FormData = require('form-data');
import { ImageProcessorService } from '../../image-processor/services/image-processor.service';

@Injectable()
export class WpApiService {
  private readonly logger = new Logger(WpApiService.name);
  
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  /**
   * Tß║úi h├¼nh mß║íng gß╗æc vß╗ü, gß╗ìi SharedModule n├⌐n v├á sideload l├¬n WP Media
   * @returns Media Attachment ID hoß║╖c null
   */
  async uploadImageToWP(imageUrl: string): Promise<{ id: number, source_url: string } | null> {
    const url = this.configService.get<string>('WP_URL');
    const wpUser = this.configService.get<string>('WP_USERNAME');
    const wpAppPass = this.configService.get<string>('WP_APP_PASSWORD');

    if (!url || !wpUser || !wpAppPass || wpUser.includes('xxx')) {
       this.logger.warn('Ch╞░a cß║Ñu h├¼nh API Key/App Pass, kh├┤ng tß║úi ─æ╞░ß╗úc ß║únh WebP!');
       return null;
    }

    try {
      // 1. Nhß╗¥ Shared Optimization Service lß║Ñy ß║únh n├⌐n
      const optimizedImage = await this.imageProcessor.processToWebp(imageUrl);
      if (!optimizedImage) return null;

      // 2. Chß║┐ tß║ío Form-data tß║úi l├¬n Web
      const formData = new FormData();
      formData.append('file', optimizedImage.buffer, {
        filename: optimizedImage.filename,
        contentType: 'image/webp',
      });

      // 3. Gß╗ìi l├¬n m├íy chß╗º cß╗¡a hiß╗çu gß╗æc
      const mediaEndpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/media`;
      const authHeader = 'Basic ' + Buffer.from(wpUser + ':' + wpAppPass).toString('base64');

      this.logger.debug(`─Éang ─æß║⌐y Webp Form-Data l├¬n m├íy chß╗º Media: ${mediaEndpoint}`);
      const uploadResp = await lastValueFrom(
        this.httpService.post(mediaEndpoint, formData, {
          headers: {
            ...formData.getHeaders(),
            Authorization: authHeader,
          },
        })
      );

      this.logger.log(`Γ£à Upload H├¼nh WordPress th├ánh c├┤ng rß╗▒c rß╗í, MEDIA ID: ${uploadResp.data.id}`);
      return { id: uploadResp.data.id, source_url: uploadResp.data.source_url };
    } catch (err) {
      this.logger.error(`Γ¥î Upload h├¼nh web thß║Ñt bß║íi: ${err.message}`);
      return null;
    }
  }

  /**
   * T├¼m danh mß╗Ñc WooCommerce theo t├¬n ch├¡nh x├íc.
   * Nß║┐u kh├┤ng t├¼m thß║Ñy ΓåÆ tß╗▒ ─æß╗Öng tß║ío mß╗¢i.
   * So khß╗¢p ch├¡nh x├íc (case-insensitive) ─æß╗â tr├ính nhß║ºm category t╞░╞íng tß╗▒.
   */
  async resolveCategory(categoryName: string, ck: string, cs: string, url: string): Promise<number | null> {
    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wc/v3/products/categories`;
    const authHeader = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');
    const normalizedTarget = categoryName.trim().toLowerCase();

    try {
      this.logger.debug(`─Éang t├¼m danh mß╗Ñc WooCommerce: "${categoryName}"`);

      // T├¼m kiß║┐m substring tr╞░ß╗¢c (WooCommerce search API)
      const searchResp = await lastValueFrom(
        this.httpService.get(`${endpoint}?search=${encodeURIComponent(categoryName)}&per_page=20`, {
          headers: { Authorization: authHeader },
        })
      );

      if (searchResp.data && searchResp.data.length > 0) {
        // So khß╗¢p exact (case-insensitive) ─æß╗â tr├ính nhß║ºm category t╞░╞íng tß╗▒
        const exactMatch = searchResp.data.find(
          (cat: { id: number; name: string }) =>
            cat.name.trim().toLowerCase() === normalizedTarget
        );

        if (exactMatch) {
          this.logger.log(`Γ£à T├¼m thß║Ñy danh mß╗Ñc ch├¡nh x├íc: "${exactMatch.name}" (ID: ${exactMatch.id})`);
          return exactMatch.id;
        }

        this.logger.warn(
          `ΓÜá∩╕Å Search trß║ú vß╗ü ${searchResp.data.length} kß║┐t quß║ú nh╞░ng kh├┤ng khß╗¢p ch├¡nh x├íc vß╗¢i "${categoryName}" ΓåÆ sß║╜ tß║ío mß╗¢i.`
        );
      }

      // Tß║ío danh mß╗Ñc mß╗¢i nß║┐u kh├┤ng tß╗ôn tß║íi
      this.logger.log(`≡ƒåò Tß╗▒ ─æß╗Öng tß║ío danh mß╗Ñc mß╗¢i: "${categoryName}"`);
      const createResp = await lastValueFrom(
        this.httpService.post(endpoint, { name: categoryName }, {
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        })
      );
      this.logger.log(`Γ£à ─É├ú tß║ío danh mß╗Ñc mß╗¢i (ID: ${createResp.data.id}): "${categoryName}"`);
      return createResp.data.id;

    } catch (err: any) {
      this.logger.error(`Γ¥î Lß╗ùi resolveCategory "${categoryName}": ${err.message}`);
      return null;
    }
  }

  /**
   * Kiß╗âm tra sß║ún phß║⌐m ─æ├ú tß╗ôn tß║íi tr├¬n WooCommerce ch╞░a (theo t├¬n ch├¡nh x├íc).
   * Bß║úo vß╗ç tr├ính push tr├╣ng ngay cß║ú khi server restart v├á mß║Ñt flag is SyncedToWp.
   * @returns WooCommerce product ID nß║┐u ─æ├ú tß╗ôn tß║íi, null nß║┐u ch╞░a c├│
   */
  async checkProductExistsOnWoo(
    productName: string,
    ck: string,
    cs: string,
    url: string,
  ): Promise<number | null> {
    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const authHeader = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');
    const normalizedName = productName.trim().toLowerCase();

    try {
      // T├¼m theo search (WooCommerce t├¼m theo title/slug)
      const resp = await lastValueFrom(
        this.httpService.get(
          `${endpoint}?search=${encodeURIComponent(productName)}&per_page=10&status=any`,
          { headers: { Authorization: authHeader } }
        )
      );

      if (resp.data && resp.data.length > 0) {
        // So khß╗¢p exact name (case-insensitive)
        const match = resp.data.find(
          (p: { id: number; name: string }) =>
            p.name.trim().toLowerCase() === normalizedName
        );
        if (match) {
          this.logger.warn(
            `ΓÜá∩╕Å  Sß║ún phß║⌐m "${productName}" ─æ├ú tß╗ôn tß║íi tr├¬n WooCommerce (ID: ${match.id}). Bß╗Å qua ─æß╗â tr├ính tr├╣ng lß║╖p.`
          );
          return match.id;
        }
      }
      return null;
    } catch (err: any) {
      // Nß║┐u WC API lß╗ùi khi check ΓåÆ cho ph├⌐p tiß║┐p tß╗Ñc push (chß║Ñp nhß║¡n rß╗ºi ro thß║Ñp h╞ín l├á bß╗Å qua)
      this.logger.warn(`ΓÜá∩╕Å  Kh├┤ng thß╗â kiß╗âm tra tr├╣ng lß║╖p WC: ${err.message} ΓåÆ tiß║┐p tß╗Ñc push.`);
      return null;
    }
  }

  private formatProductDescription(content: string): string {
    if (!content) return '';

    let text = content;

    // 1. T├ích d├▓ng c├íc ─æoß║ín d├¡nh liß╗ün theo format phß╗ò biß║┐n
    text = text.replace(/\s(\*\*\s)/g, '\n$1'); // tr╞░ß╗¢c "** "
    text = text.replace(/\s([ΓÇô-]\s)/g, '\n$1'); // tr╞░ß╗¢c "- " hoß║╖c "ΓÇô "
    text = text.replace(/\s(=>\s)/g, '\n$1'); // tr╞░ß╗¢c "=> "
    
    // T├ích d├▓ng c├íc tß╗½ kho├í (nß║┐u ph├¡a tr╞░ß╗¢c l├á khoß║úng trß║»ng)
    const keywords = ['╞»u ─æiß╗âm:', 'Chß║Ñt liß╗çu:', 'L╞░u ├╜:', 'K├¡ch th╞░ß╗¢c:', 'C├ích chß╗ìn size:', 'Xuß║Ñt xß╗⌐:', 'Th├┤ng tin li├¬n hß╗ç:', 'Sß║ún phß║⌐m ─æ├ú c├│', 'Ngo├ái ra'];
    for (const kw of keywords) {
        text = text.replace(new RegExp(`\\s(${kw})`, 'gi'), '\n$1');
    }

    // 2. Chuyß╗ân ─æß╗òi sang HTML nß║┐u ch╞░a c├│ HTML paragraph
    if (!text.includes('<p>') && !text.includes('<br')) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
        let html = '';
        let inList = false;

        for (let line of lines) {
            if (line.startsWith('**')) {
                if (inList) { html += '</ul>\n'; inList = false; }
                html += `<h4>${line.split('**').join('').trim()}</h4>\n`;
                continue;
            }
            if (line.startsWith('-') || line.startsWith('ΓÇô')) {
                if (!inList) { html += '<ul>\n'; inList = true; }
                const cleanLine = line.startsWith('- ') || line.startsWith('ΓÇô ') ? line.substring(2) : line.substring(1);
                html += `<li>${cleanLine.trim()}</li>\n`;
                continue;
            }
            if (inList) { html += '</ul>\n'; inList = false; }
            html += `<p>${line}</p>\n`;
        }
        
        if (inList) { html += '</ul>\n'; }
        return html;
    }

    return text;
  }

  private async processContentImagesAndLinks(content: string, wpDomainUrl: string): Promise<string> {
    if (!content) return content;
    try {
      const $ = cheerio.load(content, null, false);
      const imgElements = $('img').toArray();
      if (imgElements.length > 0) {
        this.logger.log(`T├¼m thß║Ñy ${imgElements.length} h├¼nh ß║únh trong nß╗Öi dung, tiß║┐n h├ánh tß║úi l├¬n WP...`);
        for (const imgEl of imgElements) {
          const $img = $(imgEl);
          const originalSrc = $img.attr('src');
          
          if (originalSrc && originalSrc.startsWith('http')) {
            this.logger.debug(`─Éang tß║úi ß║únh trong nß╗Öi dung: ${originalSrc}`);
            const uploadedMedia = await this.uploadImageToWP(originalSrc);
            if (uploadedMedia && uploadedMedia.source_url) {
              $img.attr('src', uploadedMedia.source_url);
              $img.removeAttr('srcset');
              $img.removeAttr('sizes');
              $img.removeAttr('data-src');
              
              const $parentA = $img.parent('a');
              if ($parentA.length > 0) {
                 const href = $parentA.attr('href');
                 if (href && (href.match(/\.(jpeg|jpg|gif|png|webp)/i) || href === originalSrc)) {
                     $parentA.attr('href', uploadedMedia.source_url);
                 }
              }
              this.logger.log(`Γ£à ─É├ú thay thß║┐ ß║únh trong nß╗Öi dung: ${uploadedMedia.source_url}`);
            }
          }
        }
      }

      const wpDomain = wpDomainUrl.replace(/^https?:\/\//, '').split('/')[0];
      const aElements = $('a').toArray();
      for (const aEl of aElements) {
          const $a = $(aEl);
          const href = $a.attr('href');
          if (href && href.startsWith('http') && !href.includes(wpDomain)) {
             if ($a.find('img').length === 0) {
               $a.replaceWith($a.html() || '');
             } else if (!href.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
               $a.replaceWith($a.html() || '');
             }
          }
      }
      
      return $.html();
    } catch (err: any) {
      this.logger.error(`Γ¥î Lß╗ùi parse/thay thß║┐ ß║únh/link HTML: ${err.message}`);
      return content;
    }
  }

  /**
   * Tß╗òng tiß║┐n tr├¼nh ─æß║⌐y B├ái viß║┐t -> ─æß║⌐y H├¼nh ß║únh
   */
  async pushProductToWooCommerce(product: Product): Promise<any> {
    const url = this.configService.get<string>('WP_URL');
    const ck = this.configService.get<string>('WP_CONSUMER_KEY');
    const cs = this.configService.get<string>('WP_CONSUMER_SECRET');

    if (!url || !ck || !cs || ck.includes('xx') || cs.includes('xx')) {
      throw new Error('Ch╞░a cß║Ñu h├¼nh API Key cß╗ºa WooCommerce trong file .env');
    }

    // === GUARD: Kiß╗âm tra tr├╣ng lß║╖p trß╗▒c tiß║┐p tß╗½ WooCommerce ===
    // Bß║úo vß╗ç 2 lß╗¢p: flag bß╗Ö nhß╗¢ (nhanh) + WC API (chß║»c chß║»n kß╗â cß║ú sau khi restart server)
    const existingWcId = await this.checkProductExistsOnWoo(product.name, ck, cs, url);
    if (existingWcId) {
      this.logger.warn(`ΓÅ¡∩╕Å  Bß╗Å qua push ΓÇö "${product.name}" ─æ├ú c├│ tr├¬n WooCommerce (ID: ${existingWcId}).`);
      return { id: existingWcId, alreadyExists: true, name: product.name };
    }

    // Luß╗æng kh├│a gi├í cß╗⌐ng: Lu├┤n bß║▒ng kh├┤ng (0─æ)
    const parsedPrice = '0';


    this.logger.log(`Tiß║┐n h├ánh xß╗¡ l├╜ & tß║úi l├¬n ${product.images.length} h├¼nh ß║únh...`);
    const uploadedImageObjects: { id: number }[] = [];
    
    for (const link of product.images) {
       const mediaRes = await this.uploadImageToWP(link);
       if (mediaRes) {
          uploadedImageObjects.push({ id: mediaRes.id });
       }
    }

    // === T├îM HOß║╢C Tß║áO CATEGORY ─Éß╗ÿNG ===
    let categoryObjects: {id: number}[] = [];
    if (product.category && product.category !== 'Ch╞░a Ph├ón Loß║íi' && !product.category.includes('Chß╗¥ AI')) {
        const catId = await this.resolveCategory(product.category, ck, cs, url);
        if (catId) categoryObjects.push({ id: catId });
    }

    // === META DATA RANK MATH SEO ===
    // Rank Math ─æß╗ìc c├íc custom post meta n├áy ─æß╗â hiß╗ân thß╗ï trong SEO panel
    const rankMathMeta: { key: string; value: string }[] = [];

    if (product.rankMathTitle) {
      rankMathMeta.push({ key: 'rank_math_title', value: product.rankMathTitle });
    }
    if (product.rankMathDescription) {
      rankMathMeta.push({ key: 'rank_math_description', value: product.rankMathDescription });
    }
    if (product.rankMathFocusKeyword) {
      rankMathMeta.push({ key: 'rank_math_focus_keyword', value: product.rankMathFocusKeyword });
    }
    // Mß║╖c ─æß╗ïnh index = index ─æß╗â Rank Math kh├┤ng noindex sß║ún phß║⌐m mß╗¢i
    rankMathMeta.push({ key: 'rank_math_robots', value: 'index,follow' });
    
    // Th├¬m c├íc metadata ─æß╗â fix lß╗ùi Google Merchant Center
    rankMathMeta.push({ key: '_rank_math_brand', value: 'Phß╗Ñ Gia Gi├▓ Chß║ú' });
    rankMathMeta.push({ key: '_rank_math_gtin', value: Date.now().toString() }); // Dummy GTIN-13

    if (rankMathMeta.length > 0) {
      this.logger.log(`≡ƒÄ» Gß║»n ${rankMathMeta.length} Rank Math meta fields v├áo payload...`);
    }

    let processedDescription = this.formatProductDescription(product.fullDescription);
    processedDescription = await this.processContentImagesAndLinks(processedDescription, url);

    const payload = {
      name: product.name,
      type: 'simple',
      regular_price: parsedPrice,
      description: processedDescription, // Tß║ím thß╗¥i bß╗Å qua AI
      short_description: product.shortDescription || '',
      images: uploadedImageObjects,
      categories: categoryObjects,
      // Rank Math SEO metadata ΓÇö ─æ╞░ß╗úc inject th├┤ng qua WooCommerce REST API meta_data field
      meta_data: rankMathMeta,
    };

    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const authHeader = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');

    this.logger.log(`Calling WooCommerce API: POST ${endpoint}`);

    try {
      const resp = await lastValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
             Authorization: authHeader,
             'Content-Type': 'application/json'
          }
        })
      );
      this.logger.log(`Γ£à WooCommerce trß║ú vß╗ü m├ú: ${resp.status}`);
      return resp.data;
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`Γ¥î ─Éß║⌐y l├¬n WooCommerce thß║Ñt bß║íi: ${errMsg}`);
      throw new Error(`Lß╗ùi WooCommerce: ${errMsg}`);
    }
  }

  // ====================================================================
  // PUSH NEWS TO WP POSTS
  // ====================================================================

  async resolveWpCategoryForPost(categoryName: string, user: string, pass: string, url: string): Promise<number | null> {
    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/categories`;
    const authHeader = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
    const normalizedTarget = categoryName.trim().toLowerCase();

    try {
      this.logger.debug(`─Éang t├¼m danh mß╗Ñc WP Post: "${categoryName}"`);
      const searchResp = await lastValueFrom(
        this.httpService.get(`${endpoint}?search=${encodeURIComponent(categoryName)}&per_page=20`, {
          headers: { Authorization: authHeader },
        })
      );

      if (searchResp.data && searchResp.data.length > 0) {
        const exactMatch = searchResp.data.find(
          (cat: { id: number; name: string }) =>
            cat.name.trim().toLowerCase() === normalizedTarget
        );
        if (exactMatch) {
          this.logger.log(`Γ£à T├¼m thß║Ñy danh mß╗Ñc WP Post ch├¡nh x├íc: "${exactMatch.name}" (ID: ${exactMatch.id})`);
          return exactMatch.id;
        }
      }

      this.logger.log(`≡ƒåò Tß╗▒ ─æß╗Öng tß║ío danh mß╗Ñc WP Post mß╗¢i: "${categoryName}"`);
      const createResp = await lastValueFrom(
        this.httpService.post(endpoint, { name: categoryName }, {
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        })
      );
      this.logger.log(`Γ£à ─É├ú tß║ío danh mß╗Ñc WP Post mß╗¢i (ID: ${createResp.data.id}): "${categoryName}"`);
      return createResp.data.id;
    } catch (err: any) {
      this.logger.error(`Γ¥î Lß╗ùi resolveWpCategoryForPost "${categoryName}": ${err.message}`);
      return null;
    }
  }

  async checkPostExistsOnWp(postTitle: string, user: string, pass: string, url: string): Promise<number | null> {
    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
    const authHeader = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
    const normalizedTitle = postTitle.trim().toLowerCase();

    try {
      const resp = await lastValueFrom(
        this.httpService.get(
          `${endpoint}?search=${encodeURIComponent(postTitle)}&per_page=10&status=any`,
          { headers: { Authorization: authHeader } }
        )
      );

      if (resp.data && resp.data.length > 0) {
        // In WP v2 posts, title is an object: { rendered: '...' }
        const match = resp.data.find(
          (p: { id: number; title: { rendered: string } }) => {
            // Unescape HTML entities from rendered title before comparing
            const renderedTitle = p.title.rendered.replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec)).trim().toLowerCase();
            return renderedTitle === normalizedTitle || p.title.rendered.trim().toLowerCase() === normalizedTitle;
          }
        );
        if (match) {
          this.logger.warn(`ΓÜá∩╕Å B├ái viß║┐t "${postTitle}" ─æ├ú tß╗ôn tß║íi tr├¬n WordPress (ID: ${match.id}).`);
          return match.id;
        }
      }
      return null;
    } catch (err: any) {
      this.logger.warn(`ΓÜá∩╕Å Kh├┤ng thß╗â kiß╗âm tra tr├╣ng lß║╖p WP Post: ${err.message} ΓåÆ tiß║┐p tß╗Ñc push.`);
      return null;
    }
  }

  async resolveTagIds(tags: string[]): Promise<number[]> {
    if (!tags || tags.length === 0) return [];
    const url = this.configService.get<string>('WP_URL');
    const wpUser = this.configService.get<string>('WP_USERNAME');
    const wpAppPass = this.configService.get<string>('WP_APP_PASSWORD');
    
    if (!url || !wpUser || !wpAppPass) return [];

    const authHeader = 'Basic ' + Buffer.from(wpUser + ':' + wpAppPass).toString('base64');
    
    const tagIds: number[] = [];
    for (const tagName of tags) {
      if (!tagName.trim()) continue;
      try {
        const checkUrl = `${url.replace(/\/$/, '')}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`;
        const checkResp = await lastValueFrom(
          this.httpService.get(checkUrl, { headers: { Authorization: authHeader } })
        );
        const match = checkResp.data.find((t: any) => t.name.toLowerCase() === tagName.toLowerCase());
        if (match) {
           tagIds.push(match.id);
        } else {
           const createUrl = `${url.replace(/\/$/, '')}/wp-json/wp/v2/tags`;
           const createResp = await lastValueFrom(
             this.httpService.post(createUrl, { name: tagName }, { headers: { Authorization: authHeader } })
           );
           tagIds.push(createResp.data.id);
        }
      } catch (err) {
         this.logger.error(`Γ¥î Lß╗ùi xß╗¡ l├╜ tag "${tagName}": ${err.message}`);
      }
    }
    return tagIds;
  }

  /**
   * ─Éß║⌐y b├ái viß║┐t chuß║⌐n (Standard Post) l├¬n WordPress (v├¡ dß╗Ñ: Tin tß╗⌐c)
   */
  async pushPostToWordPress(product: Product): Promise<any> {
    const url = this.configService.get<string>('WP_URL');
    const wpUser = this.configService.get<string>('WP_USERNAME');
    const wpAppPass = this.configService.get<string>('WP_APP_PASSWORD');

    if (!url || !wpUser || !wpAppPass || wpUser.includes('xxx')) {
      throw new Error('Ch╞░a cß║Ñu h├¼nh WP_USERNAME / WP_APP_PASSWORD trong file .env');
    }

    const authHeader = 'Basic ' + Buffer.from(wpUser + ':' + wpAppPass).toString('base64');

    const existingId = await this.checkPostExistsOnWp(product.name, wpUser, wpAppPass, url);
    if (existingId) {
      this.logger.warn(`ΓÅ¡∩╕Å  Bß╗Å qua push ΓÇö B├ái viß║┐t "${product.name}" ─æ├ú c├│ tr├¬n WP (ID: ${existingId}).`);
      return { id: existingId, alreadyExists: true, name: product.name };
    }

    this.logger.log(`Tß║úi l├¬n h├¼nh ß║únh ─æß║íi diß╗çn (featured image)...`);
    let featuredMediaId: number | null = null;
    if (product.images.length > 0) {
       const uploadRes = await this.uploadImageToWP(product.images[0]);
       if (uploadRes) featuredMediaId = uploadRes.id;
    }

    let categoryIds: number[] = [];
    if (product.category && product.category !== 'Ch╞░a Ph├ón Loß║íi' && !product.category.includes('Chß╗¥ AI')) {
        const catId = await this.resolveWpCategoryForPost(product.category, wpUser, wpAppPass, url);
        if (catId) categoryIds.push(catId);
    }

    // Embed remaining images into content if desired.    
    const tagIds = await this.resolveTagIds(product.tags || []);
    
    // Xß╗¡ l├╜ nß╗Öi dung (lß║Ñy description ─æ├ú tß╗æi ╞░u hoß║╖c fullDescription)
    let content = this.formatProductDescription(product.fullDescription); // Tß║ím thß╗¥i bß╗Å qua AI
    content = await this.processContentImagesAndLinks(content, url);

    const meta: Record<string, string> = {
        rank_math_robots: 'index,follow'
    };
    if (product.rankMathTitle) meta.rank_math_title = product.rankMathTitle;
    if (product.rankMathDescription) meta.rank_math_description = product.rankMathDescription;
    if (product.rankMathFocusKeyword) meta.rank_math_focus_keyword = product.rankMathFocusKeyword;

    const payload: any = {
      title: product.name,
      content: content,
      status: 'publish',
      meta: meta
    };

    if (categoryIds.length > 0) payload.categories = categoryIds;
    if (tagIds.length > 0) payload.tags = tagIds;
    if (featuredMediaId) payload.featured_media = featuredMediaId;

    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
    this.logger.log(`Calling WP Post API: POST ${endpoint}`);

    try {
      const resp = await lastValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
             Authorization: authHeader,
             'Content-Type': 'application/json'
          }
        })
      );
      this.logger.log(`Γ£à WP Post trß║ú vß╗ü m├ú: ${resp.status}`);
      return {
          id: resp.data.id,
          permalink: resp.data.link
      };
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`Γ¥î ─Éß║⌐y b├ái viß║┐t l├¬n WordPress thß║Ñt bß║íi: ${errMsg}`);
      throw new Error(`Lß╗ùi WP Post: ${errMsg}`);
    }
  }
}

