'use client';

/**
 * The birthday / anniversary graphic (1080 × 1350, Instagram portrait), drawn in the browser
 * from the media team's Canva design: a soft glow made from the person's own photo, the
 * person cut out of their photo, the church wordmark, "HAPPY BIRTHDAY" (or ANNIVERSARY), and
 * their name and date. Positions and sizes are taken from the design file.
 * Nothing is uploaded: the photo stays on the phone.
 */

export const SIZE = { width: 1080, height: 1350 };

const COLOURS = { orange: '#d48000', brown: '#472e24', top: '#eceef7', bottom: '#fcfcfe' };
// Where the person stands in the design (their feet go under the lettering).
const PHOTO = { x: 145, y: 101, width: 811, height: 962 };
// Where the design's face is (the face finder's box on the template photo, placed as in the
// design): the size and centre every celebrant's face is scaled and moved to.
const FACE = { width: 205, centreX: 540, centreY: 292 };
const WORDMARK = { x: 904, y: 25, width: 136, height: 61, src: '/graphics/church-wordmark.png' };

const WORDS = { birthday: 'BIRTHDAY', anniversary: 'ANNIVERSARY' };

let segmenter;
/**
 * Cuts the person out of a photo (MODNet portrait matting, Apache 2.0), on the phone.
 * The first time it downloads the model (~25 MB); the browser keeps it for next time.
 */
async function loadSegmenter(onStatus) {
  segmenter ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    return pipeline('background-removal', 'Xenova/modnet', {
      dtype: 'fp32',
      progress_callback: (p) => {
        if (p.status === 'progress' && p.total) {
          onStatus?.(`Getting the photo tool ready… ${Math.round((p.loaded / p.total) * 100)}%`);
        }
      },
    });
  })();
  try {
    return await segmenter;
  } catch (err) {
    segmenter = undefined; // try again next time
    throw err;
  }
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Couldn’t open that picture'));
    img.src = src;
  });

/** The photo, no bigger than 1280 px on its longest side (fast enough on a phone). */
async function readPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The photo with its background removed: { photo, person }, where `person` is the same size
 * as `photo` with transparency around the figure.
 */
export async function cutOut(file, onStatus) {
  const photo = await readPhoto(file);
  onStatus?.('Getting the photo tool ready…');
  const segment = await loadSegmenter(onStatus);
  onStatus?.('Cutting out the background…');
  const blob = await new Promise((r) => photo.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  try {
    const [result] = await segment(url);
    return { photo, person: result.toCanvas() };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The part of a transparent canvas that isn't empty: { x, y, width, height }. With `top` and
 * `bottom`, only those rows are looked at (e.g. just the head).
 */
export function subjectBounds(canvas, { top = 0, bottom = canvas.height } = {}) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let [minX, minY, maxX, maxY] = [width, height, -1, -1];
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(height, bottom); y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width, height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Text with even spacing between letters (canvas letterSpacing isn't everywhere yet). */
function spacedText(ctx, text, centreX, baseline, spacing) {
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = centreX - total / 2;
  ctx.textAlign = 'left';
  [...text].forEach((c, i) => {
    ctx.fillText(c, x, baseline);
    x += widths[i] + spacing;
  });
}

/** The largest font size (up to `size`) at which `text` fits `maxWidth`. */
function fitFont(ctx, text, font, size, maxWidth) {
  let s = size;
  ctx.font = font(s);
  while (ctx.measureText(text).width > maxWidth && s > 12) {
    s -= 2;
    ctx.font = font(s);
  }
  return s;
}

/**
 * Frame on the face: the same face size and place as the photo in the design, whatever the
 * photo (close-up, standing, off-centre). Measured from the design's own photo.
 */
function frameOnFace(face) {
  const scale = FACE.width / face.width;
  return {
    scale,
    x: FACE.centreX - (face.x + face.width / 2) * scale,
    y: FACE.centreY - (face.y + face.height / 2) * scale,
  };
}

/**
 * No face found: frame the figure from about the waist up. A full-length photo is zoomed in
 * on the head and shoulders, and the rest runs down under the lettering.
 */
function frameOnFigure(person) {
  const b = subjectBounds(person);
  const shown = Math.min(b.height, b.width * 1.3);
  const scale = Math.min((PHOTO.height * 0.97) / shown, (PHOTO.width * 1.15) / b.width);
  // Centre on the head (the top of the figure), not on arms or hands further down.
  const head = subjectBounds(person, { top: b.y, bottom: b.y + b.height * 0.2 });
  return {
    scale,
    x: PHOTO.x + PHOTO.width / 2 - (head.x + head.width / 2) * scale,
    y: PHOTO.y + 12 - b.y * scale,
  };
}

/**
 * Draws the finished graphic onto `canvas`.
 *   kind     'birthday' | 'anniversary'
 *   person   the cut-out photo (a canvas with transparency), or the plain photo
 *   face     where their face is in `person` ({ x, y, width, height }), if it was found
 *   name     e.g. "Ada Eze";  date e.g. "12 October"
 *   fonts    { display, text }: CSS font families for Bebas Neue and Quicksand
 */
export async function drawCelebration(canvas, { kind, person, face, name, date, fonts }) {
  const { width, height } = SIZE;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  await Promise.all([
    document.fonts.load(`400 200px ${fonts.display}`),
    document.fonts.load(`600 48px ${fonts.text}`),
    document.fonts.load(`500 36px ${fonts.text}`),
  ]);

  // Pale background.
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, COLOURS.top);
  base.addColorStop(1, COLOURS.bottom);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const { scale, x, y } = face ? frameOnFace(face) : frameOnFigure(person);
  const w = person.width * scale;
  const h = person.height * scale;

  // The design's warm peach glow behind the person…
  const warm = ctx.createRadialGradient(540, 400, 60, 540, 420, 640);
  warm.addColorStop(0, 'rgba(240,150,96,0.85)');
  warm.addColorStop(0.5, 'rgba(240,172,138,0.5)');
  warm.addColorStop(1, 'rgba(236,238,247,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, width, height);

  // …tinted by the photo's own colours: shrunk to a few pixels and stretched back, which
  // blurs it on every phone (Safari can't blur a canvas with a filter).
  // A clear border round the tiny copy keeps its edges soft when it's stretched.
  const pad = 4;
  const inner = { w: 12, h: Math.max(1, Math.round((12 * person.height) / person.width)) };
  const tiny = document.createElement('canvas');
  tiny.width = inner.w + pad * 2;
  tiny.height = inner.h + pad * 2;
  const t = tiny.getContext('2d');
  t.imageSmoothingQuality = 'high';
  t.drawImage(person, pad, pad, inner.w, inner.h);
  const cellW = (w * 1.3) / inner.w;
  const cellH = (h * 1.2) / inner.h;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    tiny,
    x - w * 0.15 - pad * cellW,
    y - h * 0.1 - pad * cellH,
    tiny.width * cellW,
    tiny.height * cellH,
  );
  ctx.restore();

  ctx.drawImage(person, x, y, w, h);

  // Fade to white behind the lettering, starting higher when the photo itself ends early,
  // so its bottom edge never shows as a line.
  const photoEnd = Math.min(y + h, 1110);
  const fadeFrom = Math.min(760, photoEnd - 220);
  const fade = ctx.createLinearGradient(0, fadeFrom, 0, photoEnd);
  fade.addColorStop(0, 'rgba(252,252,254,0)');
  fade.addColorStop(1, 'rgba(252,252,254,0.97)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeFrom, width, photoEnd - fadeFrom);
  ctx.fillStyle = 'rgba(252,252,254,0.97)';
  ctx.fillRect(0, photoEnd, width, height - photoEnd);

  // Church wordmark, top right.
  const mark = await loadImage(WORDMARK.src);
  ctx.drawImage(mark, WORDMARK.x, WORDMARK.y, WORDMARK.width, WORDMARK.height);

  // HAPPY / BIRTHDAY.
  ctx.fillStyle = COLOURS.orange;
  ctx.font = `600 38px ${fonts.text}`;
  spacedText(ctx, 'HAPPY', 540, 1006, 30);

  const word = WORDS[kind] ?? WORDS.birthday;
  ctx.fillStyle = COLOURS.brown;
  ctx.textAlign = 'center';
  fitFont(ctx, word, (s) => `400 ${s}px ${fonts.display}`, 216, 900);
  ctx.fillText(word, 540, 1188);

  // Name (orange) and date (brown) on one line, centred.
  const gap = 44;
  const dateFont = `500 36px ${fonts.text}`;
  ctx.font = dateFont;
  const dateWidth = ctx.measureText(date).width;
  const nameSize = fitFont(ctx, name, (s) => `600 ${s}px ${fonts.text}`, 50, 900 - gap - dateWidth);
  const nameFont = `600 ${nameSize}px ${fonts.text}`;
  ctx.font = nameFont;
  const nameWidth = ctx.measureText(name).width;
  const left = 540 - (nameWidth + gap + dateWidth) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOURS.orange;
  ctx.fillText(name, left, 1262);
  ctx.font = dateFont;
  ctx.fillStyle = COLOURS.brown;
  ctx.fillText(date, left + nameWidth + gap, 1262);
}

/** The photo as it is, for when the cut-out isn't possible: { photo, person }. */
export async function plainPhoto(file) {
  const photo = await readPhoto(file);
  return { photo, person: photo };
}
