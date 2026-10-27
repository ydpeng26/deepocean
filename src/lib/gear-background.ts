// Conservative edge-connected light-background removal. Not an AI segmenter.
// Never upload pixels or fetch external models. Ambiguous images keep the original.
export function removeLightBackground(pixels: Uint8ClampedArray, width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 8 ||
    height < 8 ||
    width * height > 2_560_000 ||
    pixels.length !== width * height * 4
  )
    throw new Error("Invalid image dimensions");
  const output = new Uint8ClampedArray(pixels);
  const total = width * height;
  if (pixels.some((value, i) => i % 4 === 3 && value < 250))
    return { pixels: output, status: "already-transparent" as const };
  const corners = [0, width - 1, (height - 1) * width, total - 1];
  const color = [0, 1, 2].map(
    (channel) => corners.reduce((sum, p) => sum + pixels[p * 4 + channel], 0) / 4,
  );
  if (
    color.some((value) => value < 210) ||
    corners.some((p) =>
      color.some((value, channel) => Math.abs(pixels[p * 4 + channel] - value) > 18),
    )
  )
    return { pixels: output, status: "not-simple" as const };
  const seen = new Uint8Array(total),
    queue = new Int32Array(total);
  let tail = 0,
    head = 0;
  function add(p: number) {
    if (seen[p]) return;
    seen[p] = 1;
    const dr = pixels[p * 4] - color[0],
      dg = pixels[p * 4 + 1] - color[1],
      db = pixels[p * 4 + 2] - color[2];
    if (dr * dr + dg * dg + db * db <= 38 * 38) queue[tail++] = p;
  }
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const p = queue[head++],
      x = p % width;
    output[p * 4 + 3] = 0;
    if (x > 0) add(p - 1);
    if (x < width - 1) add(p + 1);
    if (p >= width) add(p - width);
    if (p < total - width) add(p + width);
  }
  if (tail < total * 0.05 || tail > total * 0.92)
    return { pixels: new Uint8ClampedArray(pixels), status: "not-simple" as const };
  return { pixels: output, status: "removed" as const };
}
