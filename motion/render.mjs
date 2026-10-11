#!/usr/bin/env node
// Exporta motion/aval-30s.html para MP4 (1920×1080, 30 fps, 900 quadros).
// Uso: node motion/render.mjs [saida.mp4]
// Requer ffmpeg no PATH e @playwright/test (devDependency do repositório).
// CHROME_PATH=/caminho/do/chrome usa um Chromium já instalado.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, 'aval-30s.mp4'));
const url = pathToFileURL(path.join(here, 'aval-30s.html')).href + '?capture=1';

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('pageerror:', e.message));
await page.goto(url);
const { FPS, FRAMES } = await page.evaluate(async () => { await window.__aval.ready; return { FPS: window.__aval.FPS, FRAMES: window.__aval.FRAMES }; });

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg saiu com código ' + c))));

for (let f = 0; f < FRAMES; f++) {
  await page.evaluate(n => window.__aval.frame(n), f);
  const png = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 30 === 0) process.stdout.write(`\r${String(f / FPS).padStart(2)}s / ${FRAMES / FPS}s`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`\nok → ${out}`);
