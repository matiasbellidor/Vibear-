// Phone photos are 3-8 MB; the API works at 1600px max anyway. Shrinking in the browser first
// turns a slow upload into a ~300 KB one.
const MAX_SIDE = 1600;
const KEEP_IF_SMALLER_THAN = 1_500_000;

export async function downscale(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // A format this browser can't decode (e.g. HEIC on Chrome): let the API decide.
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < KEEP_IF_SMALLER_THAN) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.fillStyle = "#ffffff"; // JPEG has no alpha: transparent PNGs get a white background, not black.
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.9));
}
