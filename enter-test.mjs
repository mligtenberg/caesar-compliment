import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
await page.goto('http://localhost:4200/');
await page.waitForSelector('three-d-stage', { timeout: 15000 });
// give the scene time to boot and rack.js to load
await page.waitForTimeout(3000);

// Click into the middle of the canvas to select a tier, then again to lift a card.
const canvas = await page.waitForSelector('three-d-stage canvas', { timeout: 15000 });
const box = await canvas.boundingBox();
console.log('canvas box', box);

async function clickAt(xr, yr) {
  await page.mouse.click(box.x + box.width * xr, box.y + box.height * yr);
  await page.waitForTimeout(600);
}

// try clicking near each of the 4 tiers vertically to select one
for (const yr of [0.3, 0.45, 0.6, 0.75]) {
  await clickAt(0.5, yr);
}
await page.waitForTimeout(500);

// try clicking on a card within the selected tier (center-ish)
await clickAt(0.5, 0.5);
await page.waitForTimeout(500);

const chooseBtnVisible = await page.evaluate(() => {
  const el = document.getElementById('choose-card-btn');
  return el ? getComputedStyle(el).display : null;
});
console.log('choose-btn display:', chooseBtnVisible);

if (chooseBtnVisible === 'block') {
  await page.click('#choose-card-btn');
  await page.waitForTimeout(300);
  const submitVisible = await page.evaluate(() => {
    const el = document.getElementById('compliment-submit');
    return el ? getComputedStyle(el).display : null;
  });
  console.log('submit display:', submitVisible);

  await page.click('#compliment-text');
  await page.keyboard.type('Hello');
  await page.keyboard.press('Enter');
  await page.keyboard.type('World');
  await page.waitForTimeout(300);
  const value = await page.$eval('#compliment-text', (el) => el.value);
  console.log('textarea value after Enter:', JSON.stringify(value));
  const submitVisible2 = await page.evaluate(() => {
    const el = document.getElementById('compliment-submit');
    return el ? getComputedStyle(el).display : null;
  });
  console.log('submit display after Enter:', submitVisible2);
  const thanksVisible = await page.evaluate(() => {
    const el = document.getElementById('thanks-overlay');
    return el ? getComputedStyle(el).display : null;
  });
  console.log('thanks-overlay display after Enter:', thanksVisible);
} else {
  console.log('could not get to compliment flow, dumping DOM state');
  console.log(await page.content());
}

await browser.close();
