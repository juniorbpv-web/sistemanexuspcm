/**
 * Utility to generate the official Sistema PCM NEXUS Logo as high-resolution
 * Base64 data URLs for embedding into PDF reports (jsPDF) and Excel exports.
 */

const GEAR_PATH =
  'M 123.95 28.67 L 146.05 28.67 L 143.65 48.52 L 163.25 53.77 L 171.10 35.38 L 190.24 46.43 L 178.23 62.42 L 192.58 76.77 L 208.57 64.76 L 219.62 83.90 L 201.23 91.75 L 206.48 111.35 L 226.33 108.95 L 226.33 131.05 L 206.48 128.65 L 201.23 148.25 L 219.62 156.10 L 208.57 175.24 L 192.58 163.23 L 178.23 177.58 L 190.24 193.57 L 171.10 204.62 L 163.25 186.23 L 143.65 191.48 L 146.05 211.33 L 123.95 211.33 L 126.35 191.48 L 106.75 186.23 L 98.90 204.62 L 79.76 193.57 L 91.77 177.58 L 77.42 163.23 L 61.43 175.24 L 50.38 156.10 L 68.77 148.25 L 63.52 128.65 L 43.67 131.05 L 43.67 108.95 L 63.52 111.35 L 68.77 91.75 L 50.38 83.90 L 61.43 64.76 L 77.42 76.77 L 91.77 62.42 L 79.76 46.43 L 98.90 35.38 L 106.75 53.77 L 126.35 48.52 Z';

let cachedLogoDataUrl: string | null = null;
let cachedInfraBannerUrl: string | null = null;

/**
 * Returns a high-DPI Base64 Data URL of the official circular PCM NEXUS logo.
 */
export function getMakmoCombustivelLogoBase64(): string {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }

  if (typeof document === 'undefined') {
    return '';
  }

  try {
    const size = 500;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const cx = 250;
    const cy = 250;

    // 1. Deep Blue background circle
    ctx.fillStyle = '#133863';
    ctx.beginPath();
    ctx.arc(cx, cy, 245, 0, Math.PI * 2);
    ctx.fill();

    // 2. Outer Teal border ring
    ctx.strokeStyle = '#20bdae';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 235, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Draw Gear scaled in center
    ctx.save();
    ctx.translate(cx - 135 * 1.5, cy - 120 * 1.5 - 30);
    ctx.scale(1.5, 1.5);

    if (typeof Path2D !== 'undefined') {
      const pGear = new Path2D(GEAR_PATH);
      ctx.fillStyle = '#20bdae';
      ctx.fill(pGear);

      // Inner Hole
      ctx.fillStyle = '#133863';
      ctx.beginPath();
      ctx.arc(135, 120, 48, 0, Math.PI * 2);
      ctx.fill();

      // Trend Arrow
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(98, 138);
      ctx.lineTo(118, 114);
      ctx.lineTo(135, 131);
      ctx.lineTo(162, 94);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(170, 84);
      ctx.lineTo(148, 88);
      ctx.lineTo(162, 102);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 4. Text PCM NEXUS at bottom of circle
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('PCM NEXUS', cx, 420);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('SISTEMA', cx, 375);

    cachedLogoDataUrl = canvas.toDataURL('image/png');
    return cachedLogoDataUrl;
  } catch (err) {
    console.error('Error creating PCM NEXUS Circular Logo base64:', err);
    return '';
  }
}

/**
 * Returns a high-DPI Base64 Data URL of the official Sistema PCM NEXUS corporate banner logo.
 * Replicates the exact typography, glyphs, and deep blue banner styling for PDF reports.
 */
export function getMakmoInfraestruturaBannerBase64(): string {
  if (cachedInfraBannerUrl) {
    return cachedInfraBannerUrl;
  }

  if (typeof document === 'undefined') {
    return '';
  }

  try {
    const width = 800;
    const height = 240;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Background in Corporate Deep Blue (#133863)
    ctx.fillStyle = '#133863';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Gear & Trend Arrow
    if (typeof Path2D !== 'undefined') {
      const pGear = new Path2D(GEAR_PATH);
      ctx.fillStyle = '#20bdae';
      ctx.fill(pGear);

      // Inner Hole
      ctx.fillStyle = '#133863';
      ctx.beginPath();
      ctx.arc(135, 120, 48, 0, Math.PI * 2);
      ctx.fill();

      // Trend Arrow
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(98, 138);
      ctx.lineTo(118, 114);
      ctx.lineTo(135, 131);
      ctx.lineTo(162, 94);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(170, 84);
      ctx.lineTo(148, 88);
      ctx.lineTo(162, 102);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Typography
    // Top text: "Sistema"
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '400 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Sistema', 265, 84);

    // Bottom text: "PCM NEXUS"
    ctx.font = '800 82px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PCM ', 265, 166);

    const pcmWidth = ctx.measureText('PCM ').width;
    ctx.fillStyle = '#20bdae';
    ctx.fillText('NEXUS', 265 + pcmWidth, 166);

    cachedInfraBannerUrl = canvas.toDataURL('image/png');
    return cachedInfraBannerUrl;
  } catch (err) {
    console.error('Error creating Sistema PCM NEXUS Banner base64:', err);
    return '';
  }
}
