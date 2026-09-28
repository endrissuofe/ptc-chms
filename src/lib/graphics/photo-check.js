'use client';

/**
 * Finds the face in a celebrant's photo and checks the photo is good enough to post, all on
 * the phone (MediaPipe face detector, Apache 2.0, ~0.2 MB). Used to frame the graphic on the
 * face and to warn about blurry, dark, small or group photos before the media team posts it.
 */

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

let detector;
async function loadDetector() {
  detector ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM);
    return FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
    });
  })();
  try {
    return await detector;
  } catch (err) {
    detector = undefined;
    throw err;
  }
}

/** Faces in `canvas` (optionally only inside `area`), in the canvas's own pixels. */
function findFaces(
  face,
  canvas,
  area = { x: 0, y: 0, width: canvas.width, height: canvas.height },
) {
  // The detector is tuned for close-up faces, so a small area is enlarged first.
  const size = 640;
  const scale = size / Math.max(area.width, area.height);
  const crop = document.createElement('canvas');
  crop.width = Math.round(area.width * scale);
  crop.height = Math.round(area.height * scale);
  crop
    .getContext('2d')
    .drawImage(canvas, area.x, area.y, area.width, area.height, 0, 0, crop.width, crop.height);
  return face.detect(crop).detections.map((d) => ({
    x: area.x + d.boundingBox.originX / scale,
    y: area.y + d.boundingBox.originY / scale,
    width: d.boundingBox.width / scale,
    height: d.boundingBox.height / scale,
    score: d.categories?.[0]?.score ?? 0,
  }));
}

/** Grey pixels of part of a canvas, resized to `size` wide. */
function greyPixels(canvas, box, size = 160) {
  const w = size;
  const h = Math.max(1, Math.round((size * box.height) / box.width));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return { grey, w, h };
}

/** Sharpness (variance of the Laplacian: low = blurry) and brightness (0–255) of a region. */
export function sharpnessAndBrightness(canvas, box) {
  const { grey, w, h } = greyPixels(canvas, box);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let light = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const lap = grey[i - 1] + grey[i + 1] + grey[i - w] + grey[i + w] - 4 * grey[i];
      sum += lap;
      sumSq += lap * lap;
      light += grey[i];
      n += 1;
    }
  }
  const mean = sum / n;
  return { sharpness: sumSq / n - mean * mean, brightness: light / n };
}

/**
 * Looks at the photo: where the face is, and anything to warn about.
 *   photo   the original photo (canvas)
 *   figure  where the cut-out person is in it ({ x, y, width, height }), if known
 * Returns { face, warnings }. Never throws: with no detector, it just finds nothing.
 */
export async function checkPhoto(photo, figure) {
  const warnings = [];
  let faces = [];
  try {
    const face = await loadDetector();
    faces = findFaces(face, photo).filter((f) => f.score >= 0.6);
    if (!faces.length && figure) {
      // A small face in a full-length photo: look again in the top of the figure, enlarged.
      const top = {
        x: Math.max(0, figure.x - figure.width * 0.1),
        y: figure.y,
        width: Math.min(photo.width, figure.width * 1.2),
        height: Math.min(
          photo.height - figure.y,
          Math.max(figure.width * 1.2, figure.height * 0.35),
        ),
      };
      faces = findFaces(face, photo, top).filter((f) => f.score >= 0.5);
    }
  } catch {
    return { face: null, warnings };
  }

  if (!faces.length) {
    // Often because the photo is blurry: say so if the top of the figure is soft.
    const area = figure
      ? {
          x: figure.x,
          y: figure.y,
          width: figure.width,
          height: Math.min(figure.height, figure.width),
        }
      : { x: 0, y: 0, width: photo.width, height: photo.height };
    const { sharpness } = sharpnessAndBrightness(photo, area);
    warnings.push(
      sharpness < 20
        ? 'This photo looks blurry, so we couldn’t find their face. A sharper one will look better.'
        : 'We couldn’t find a face. Choose a photo where their face is clear.',
    );
    return { face: null, warnings };
  }
  const main = faces.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  // One person with hair and arms is rarely more than ~5 faces wide; a group is wider.
  const crowd = faces.length > 1 || (figure && figure.width > main.width * 6);
  if (crowd) {
    warnings.push(
      'There’s more than one person in this photo. For the best result, crop it to just the celebrant first.',
    );
  }
  // The celebrant: the biggest face.
  const face = main;

  if (face.width < 70) {
    warnings.push(
      'Their face is small in this photo, so it may look soft. A closer photo is better.',
    );
  }
  const { sharpness, brightness } = sharpnessAndBrightness(photo, face);
  // A dark photo looks soft to the sharpness check, so only one of the two is said.
  if (brightness < 55) warnings.push('This photo is quite dark. A brighter one will look better.');
  else if (sharpness < 45)
    warnings.push('This photo looks blurry. A sharper one will look better.');
  else if (brightness > 225)
    warnings.push('This photo is very bright, so their face may look washed out.');

  return { face, warnings };
}
