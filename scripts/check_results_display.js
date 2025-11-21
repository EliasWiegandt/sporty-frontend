import puppeteer from 'puppeteer';

const BASE = process.argv[2] || 'http://127.0.0.1:4321';
const sampleResult = {
  matches: [
    {
      score_breakdown: {
        components: {
          body: { score: 0.85, weight: 0.7 },
          past: { score: 0.4, weight: 0.3 },
        },
        metrics: {
          height_cm: {
            user_value: 168,
            cohort_mean: 175,
            cohort_std_dev: 4,
            fit_score: 0.96,
          },
        },
        details: { traits: { body: {} }, past_sports: [] },
      },
      optimal_body: {
        sport_slug: 'swimming',
        category_slug: 'swimming-freestyle',
        spec: {
          media: { card: { url: 'https://placekitten.com/400/240', alt: 'Cat athlete' } },
        },
        sport: { name: 'Swimming' },
        subcategory: { name: 'Freestyle (Mid)' },
      },
    },
  ],
};

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR', err?.message));
  await page.evaluateOnNewDocument((data) => {
    sessionStorage.setItem('sporty:lastResult', JSON.stringify(data));
  }, sampleResult);
  await page.goto(`${BASE}/results`, { waitUntil: 'networkidle0' });
  const stored = await page.evaluate(() => sessionStorage.getItem('sporty:lastResult'));
  console.log('stored length', stored ? stored.length : 'none');
  const gridHtml = await page.$eval('[data-match-grid]', (el) => el.innerHTML);
  console.log('match grid html length', gridHtml.length, 'starts with', gridHtml.slice(0, 40));
  const matchCount = await page.$$eval('.match-card', (cards) => cards.length).catch(() => -1);
  console.log('match cards after load:', matchCount);
  const fallbackVisible = await page.$eval('[data-empty-state]', (el) => !el.hidden);
  console.log('empty state visible?', fallbackVisible);
  await browser.close();
})();
