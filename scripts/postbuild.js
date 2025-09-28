#!/usr/bin/env node
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, '..', 'dist');
const sourceIgnore = join(__dirname, '..', '.assetsignore');
const targetIgnore = join(distDir, '.assetsignore');

try {
  await mkdir(distDir, { recursive: true });
  await copyFile(sourceIgnore, targetIgnore);
  console.log('Copied .assetsignore into dist/ for Wrangler assets upload');
} catch (error) {
  console.warn('postbuild: unable to copy .assetsignore', error);
}
