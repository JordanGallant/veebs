import { el } from '../lib/dom.js';
import { getThemeColor } from '../lib/colors.js';

export function createWhatsAppQR(parent) {
  const canvas = document.createElement('canvas');
  const size = 180;
  canvas.width = size;
  canvas.height = size;
  drawMockQR(canvas, getThemeColor('--color-bg'), getThemeColor('--color-fg'));

  const statusDot = el('span', { class: 'status-dot status-dot--off' });
  const statusText = el('span', { class: 'text-sm secondary' }, 'Not connected');
  const statusRow = el('div', { style: 'display:flex;align-items:center' }, statusDot, statusText);

  const instructions = el('p', { class: 'text-sm secondary', style: 'max-width:320px;text-align:center' },
    'Open WhatsApp on your phone, go to Settings > Linked Devices > Link a Device, and scan this QR code.',
  );

  const wrapper = el('div', { class: 'qr-container' },
    el('p', { class: 'bold' }, 'Connect WhatsApp'),
    canvas,
    statusRow,
    instructions,
  );

  parent.appendChild(wrapper);
}

function drawMockQR(canvas, bg, fg) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const modules = 25;
  const cellSize = size / modules;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = fg;

  drawFinderPattern(ctx, 0, 0, cellSize, bg, fg);
  drawFinderPattern(ctx, (modules - 7) * cellSize, 0, cellSize, bg, fg);
  drawFinderPattern(ctx, 0, (modules - 7) * cellSize, cellSize, bg, fg);

  const seed = 42;
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (isFinderArea(x, y, modules)) continue;
      const hash = ((x * 31 + y * 37 + seed) * 2654435761) >>> 0;
      if (hash % 3 === 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
}

function drawFinderPattern(ctx, x, y, cell, bg, fg) {
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, 7 * cell, 7 * cell);

  ctx.fillStyle = bg;
  ctx.fillRect(x + cell, y + cell, 5 * cell, 5 * cell);

  ctx.fillStyle = fg;
  ctx.fillRect(x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell);
}

function isFinderArea(x, y, modules) {
  if (x < 8 && y < 8) return true;
  if (x >= modules - 8 && y < 8) return true;
  if (x < 8 && y >= modules - 8) return true;
  return false;
}
