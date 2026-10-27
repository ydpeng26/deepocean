import type { Dive } from "@/lib/dives";

export type CardOptions = {
  position: "left" | "center" | "right";
  date: boolean;
  location: boolean;
  data: boolean;
  note: boolean;
  signature: boolean;
};
export const defaultCardOptions: CardOptions = {
  position: "center",
  date: true,
  location: true,
  data: true,
  note: false,
  signature: false,
};
export const CARD_WIDTH = 1080,
  CARD_HEIGHT = 1350,
  CARD_PHOTO_HEIGHT = 780;
export function cardText(value: string | null | undefined, limit = 160) {
  // Strip control/bidi characters from user text before canvas layout.
  return Array.from((value ?? "").replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, " ").trim())
    .slice(0, limit)
    .join("");
}
export function cardLines(
  dive: Dive,
  options: CardOptions,
  note: string,
  signature: string,
  en: boolean,
) {
  return {
    title: options.location ? cardText(dive.site_name, 100) : "OCEAN MEMORY",
    location: options.location
      ? cardText([dive.country, dive.region].filter(Boolean).join(" · "), 120)
      : "",
    date: options.date ? cardText(dive.dive_date, 10) : "",
    note: options.note ? cardText(note, 160) : "",
    signature: options.signature ? cardText(signature, 48) : "",
    stats: options.data
      ? [
          {
            value: dive.max_depth == null ? "—" : `${dive.max_depth} m`,
            label: en ? "MAX DEPTH" : "最大深度",
          },
          {
            value: dive.duration_min == null ? "—" : `${dive.duration_min} min`,
            label: en ? "DIVE TIME" : "潜水时长",
          },
          {
            value: dive.water_temp == null ? "—" : `${dive.water_temp} °C`,
            label: en ? "WATER" : "水温",
          },
        ]
      : [],
  };
}
export function coverCrop(width: number, height: number, position: CardOptions["position"]) {
  const ratio = CARD_WIDTH / CARD_PHOTO_HEIGHT;
  const sw = Math.min(width, height * ratio),
    sh = Math.min(height, width / ratio);
  return [
    (width - sw) * (position === "left" ? 0 : position === "right" ? 1 : 0.5),
    (height - sh) / 2,
    sw,
    sh,
  ];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const chars = Array.from(text),
    lines: string[] = [];
  let line = "";
  for (let i = 0; i < chars.length; i++) {
    const next = line + chars[i];
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      while (line && ctx.measureText(line + "…").width > width)
        line = Array.from(line).slice(0, -1).join("");
      lines.push(line + "…");
      return lines;
    }
    lines.push(line);
    line = chars[i];
  }
  if (line) lines.push(line);
  return lines;
}

// The preview and downloaded PNG are the exact same rendered bitmap.
export async function renderShareCard(
  photo: Blob | null,
  dive: Dive,
  options: CardOptions,
  note: string,
  signature: string,
  en: boolean,
  signal: AbortSignal,
) {
  const photoUrl = photo ? URL.createObjectURL(photo) : null;
  const image = new Image();
  try {
    if (photoUrl) {
      image.src = photoUrl;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("image_timeout")), 15000);
        image.decode().then(
          () => {
            clearTimeout(timer);
            resolve();
          },
          () => {
            clearTimeout(timer);
            reject(Error("image_decode"));
          },
        );
      });
      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > 40_000_000
      )
        throw Error("invalid_image");
    }
    if (signal.aborted) throw Error("aborted");
    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("canvas_unavailable");
    if (photoUrl) {
      const [sx, sy, sw, sh] = coverCrop(image.naturalWidth, image.naturalHeight, options.position);
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, CARD_WIDTH, CARD_PHOTO_HEIGHT);
    } else {
      const ocean = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_PHOTO_HEIGHT);
      ocean.addColorStop(0, "#08789c");
      ocean.addColorStop(0.5, "#043553");
      ocean.addColorStop(1, "#000e27");
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, CARD_WIDTH, CARD_PHOTO_HEIGHT);
    }
    const shade = ctx.createLinearGradient(0, 0, 0, CARD_PHOTO_HEIGHT);
    shade.addColorStop(0, "rgba(0,12,28,.38)");
    shade.addColorStop(0.35, "rgba(0,12,28,.04)");
    shade.addColorStop(1, "rgba(0,12,28,.12)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_PHOTO_HEIGHT);
    ctx.strokeStyle = "rgba(180,230,255,.4)";
    ctx.strokeRect(28, 28, CARD_WIDTH - 56, CARD_PHOTO_HEIGHT - 56);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, CARD_PHOTO_HEIGHT, CARD_WIDTH, CARD_HEIGHT - CARD_PHOTO_HEIGHT);
    const font = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = "#f3faff";
    ctx.font = `700 30px ${font}`;
    ctx.fillText("SUPDIVER", 70, 104);
    ctx.fillStyle = "#a5d9f3";
    ctx.font = `18px ${font}`;
    ctx.fillText("YOUR OCEAN. YOUR STORY.", 70, 140);
    const lines = cardLines(dive, options, note, signature, en);
    let y = CARD_PHOTO_HEIGHT + 56;
    const draw = (
      text: string,
      size: number,
      color: string,
      maxLines: number,
      spacing: number,
      weight = 400,
    ) => {
      if (!text) return;
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.fillStyle = color;
      for (const line of wrap(ctx, text, 940, maxLines)) {
        ctx.fillText(line, 70, y);
        y += spacing;
      }
    };
    draw(lines.location, 22, "#487487", 1, 64);
    draw(lines.title, 46, "#11374a", 2, 56, 700);
    draw(lines.date, 23, "#617c8a", 1, 40);
    draw(lines.note, 24, "#365562", 3, 34);
    if (lines.stats.length) {
      y += 14;
      ctx.strokeStyle = "#d6e3e9";
      ctx.beginPath();
      ctx.moveTo(70, y);
      ctx.lineTo(1010, y);
      ctx.stroke();
      lines.stats.forEach((stat, i) => {
        const x = 70 + i * 320;
        ctx.fillStyle = "#143e52";
        ctx.font = `600 32px ${font}`;
        ctx.fillText(stat.value, x, y + 48);
        ctx.fillStyle = "#648292";
        ctx.font = `20px ${font}`;
        ctx.fillText(stat.label, x, y + 80);
      });
      y += 110;
    }
    if (lines.signature) {
      ctx.font = `22px ${font}`;
      ctx.fillStyle = "#365c70";
      ctx.textAlign = "right";
      const signatureLine = wrap(ctx, `— ${lines.signature}`, 940, 1)[0];
      ctx.fillText(signatureLine, 1010, CARD_HEIGHT - 52);
      ctx.textAlign = "left";
    }
    if (signal.aborted) throw Error("aborted");
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(Error("encode_failed"))),
        "image/png",
      ),
    );
    if (signal.aborted || !blob.size || blob.size > 10 * 1024 * 1024) throw Error("encode_failed");
    // Generic filename deliberately excludes location, date, identity and private IDs.
    return new File([blob], "SupDiver-memory.png", { type: "image/png" });
  } finally {
    image.src = "";
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }
}
