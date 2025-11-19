import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = process.argv[2] || 'http://127.0.0.1:8787';
const OUT_DIR = process.argv[3] || 'screenshots';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

(async () => {
  console.log(`Launching Puppeteer to snap intake flow at ${BASE_URL}...`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });

  // 1. Go to Intake (Step 1: Basics)
  console.log('Navigating to /intake...');
  await page.goto(`${BASE_URL}/intake`, { waitUntil: 'networkidle0' });
  console.log('Loaded /intake');
  await page.screenshot({ path: `${OUT_DIR}/intake_01_basics.png` });

  // 2. Fill Basics
  console.log('Filling Basics...');
  // Birthday
  const birthdayInput = await page.$('#birthday');
  if (birthdayInput) {
      await birthdayInput.type('1995-05-15');
  } else {
      console.error('Birthday input not found!');
  }

  // Sex (click the label or input)
  const maleRadio = await page.$('input[name="sex"][value="male"]');
  if (maleRadio) {
      // Puppeteer click on radio might not work if it's hidden/styled, clicking parent label is safer if we knew the ID
      // But let's try clicking the element itself or force clicking
      await maleRadio.click();
  } else {
      console.error('Sex radio not found!');
  }
  
  await page.screenshot({ path: `${OUT_DIR}/intake_01_basics_filled.png` });

  // Click Continue
  const continueBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
  });
  
  if (continueBtn.asElement()) {
    await continueBtn.click();
  } else {
    console.error('Continue button not found on Step 1');
    await browser.close();
    process.exit(1);
  }

  // 3. Wait for Step 2 (Measurements)
  console.log('Waiting for Step 2...');
  try {
      await page.waitForSelector('#height_cm', { timeout: 5000 });
  } catch (e) {
      console.error('Timeout waiting for Step 2. Validation might have failed.');
      await page.screenshot({ path: `${OUT_DIR}/intake_error_step1_submit.png` });
      await browser.close();
      process.exit(1);
  }

  console.log('Loaded Step 2');
  await page.screenshot({ path: `${OUT_DIR}/intake_02_measurements_empty.png` });

  // 4. Fill Measurements
  console.log('Filling Measurements...');
  const measurements = {
    height_cm: '180',
    weight_kg: '75',
    arm_span_cm: '182',
    leg_inseam_cm: '85',
    shoulder_width_cm: '45',
    hip_width_cm: '40',
    torso_length_cm: '55',
    hand_length_cm: '19',
    foot_length_cm: '27',
    ankle_circumference_cm: '22',
    wrist_circumference_cm: '17'
  };

  for (const [id, value] of Object.entries(measurements)) {
      const input = await page.$(`#${id}`);
      if (input) {
          // Clear and type
          await input.click({ clickCount: 3 });
          await input.type(value);
      } else {
          console.warn(`Measurement input #${id} not found.`);
      }
  }
  
  // Snap filled state
  await page.screenshot({ path: `${OUT_DIR}/intake_02_measurements_filled.png` });

  // Click Continue
  const continueBtn2 = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
  });
  if (continueBtn2.asElement()) {
      await continueBtn2.click();
  } else {
      console.error('Continue button not found on Step 2');
  }

  // 5. Wait for Step 3 (Past Sports)
  console.log('Waiting for Step 3...');
  try {
    await page.waitForSelector('[data-step="past-sports"]', { timeout: 5000 });
  } catch (e) {
    console.error('Timeout waiting for Step 3.');
    await page.screenshot({ path: `${OUT_DIR}/intake_error_step2_submit.png` });
  }
  
  console.log('Loaded Step 3');
  await page.screenshot({ path: `${OUT_DIR}/intake_03_pastsports.png` });

  await browser.close();
  console.log('Done.');
})();
