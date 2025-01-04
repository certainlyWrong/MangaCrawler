import { chromium, type Browser, type Page } from "playwright";

export interface Card {
  title: string;
  link: string;
  lowImage: string;
}

export interface Meta {
  available: string;
  genres: string[];
  alternative: string;
  link: string;
  highImage: string;
  mangaType: string;
  chapterLinks: string[];
  status: string;
  resume: string;
}

export interface Cap {
  number: string;
  links: string[];
}

export class NavigationController {
  private browser: Browser | null = null;

  constructor() { }

  async load() {
    this.browser = await chromium.launch();
  }

  async open(url: string) {
    if (!this.browser) {
      throw new Error("Browser not loaded");
    }

    const page = await this.browser.newPage();
    await page.goto(url);
    // await page.waitForLoadState("networkidle");
    await page.waitForLoadState("domcontentloaded");

    return page;
  }

  async getCards(page: Page) {
    const elementCards = await page.$$(".page-item-detail.manga");

    const cards: Card[] = [];

    for (const elementCard of elementCards) {
      const title = await elementCard.$("a").then(async (el) => {
        const title = await el?.getAttribute("title");
        return title;
      });
      const link = await elementCard.$("a").then(async (el) => {
        const href = await el?.getAttribute("href");
        return href;
      });
      const image = await elementCard.$("img").then(async (el) => {
        const srcset = await el?.getAttribute("srcset");
        if (srcset) {
          const images = srcset?.split(", ");
          if (images) {
            const image = images[images.length - 1];
            const [url] = image.split(" ");
            return url;
          }
        }
      });

      if (title && link && image) {
        cards.push({
          title,
          link,
          lowImage: image,
        });
      }
    }

    return cards;
  }

  async getMeta(page: Page): Promise<Meta> {
    const highImage = await page.$(".summary_image img").then(async (el) => {
      const srcset = await el?.getAttribute("srcset");
      if (srcset) {
        const images = srcset?.split(", ");
        if (images) {
          const image = images[images.length - 1];
          const [url] = image.split(" ");
          return url;
        }
      }
    });

    const available = await page
      .$(".score.font-meta.total_votes")
      .then(async (el) => {
        const available = await el?.textContent();
        return available;
      });

    const genres = await page.$(".genres-content").then(async (el) => {
      return el?.$$("a").then(async (elements) => {
        const genres: string[] = [];

        for (const element of elements) {
          const genre = await element.textContent();
          if (genre) genres.push(genre);
        }

        return genres;
      });
    });

    const alternative = await page
      .$$(".post-content_item")
      .then(async (el) =>
        el[1].$(".summary-content").then(async (el) => el?.textContent())
      );

    const mangaType = await page
      .$$(".post-content_item")
      .then(async (el) =>
        el[3].$(".summary-content").then(async (el) => el?.textContent())
      );

    const mangaStatus = await page
      .$$(".post-content_item")
      .then(async (el) =>
        el[5].$(".summary-content").then(async (el) => el?.textContent())
      );

    const chapterLinks = await page.$$(".wp-manga-chapter a").then(async (el) => {
      const promiseCapsUrl = await el.map(async (element) => {
        const link = await element.getAttribute("href");
        return link?.trim() || "";
      });

      const capsUrl = await Promise.all(promiseCapsUrl);

      return capsUrl;
    });

    const resume = await page.$$(".description-summary p").then(async (el) => {
      const resume = await el[1]?.textContent();
      return resume;
    });

    return {
      available: available || "",
      link: page.url(),
      genres: genres || [],
      alternative: alternative?.trim() || "",
      highImage: highImage || "",
      mangaType: mangaType?.trim() || "",
      chapterLinks: chapterLinks,
      status: mangaStatus?.trim() || "",
      resume: resume || "",
    };
  }

  async getChapters(page: Page, capNumber: string) {
    const cap = await page.$$(".reading-content img").then(async (el) => {
      const cap: Cap = {
        number: capNumber,
        links: [],
      };

      for (const element of el) {
        const src = await element?.getAttribute("src");

        if (src) {
          cap.links.push(src.trim());
        }
      }

      return cap;
    });

    if (cap.links.length === 0) {
      throw new Error("No images found");
    }

    return cap;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
