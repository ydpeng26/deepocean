export type WebImageOptions = {
  maxEdge: number;
  quality: number;
  suffix?: string;
};

export const WEB_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

function rejectHeic(file: Pick<File, "type" | "name">) {
  if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type))
    throw new Error(
      "暂不支持 HEIC/HEIF，请先转换为 JPG、PNG 或 WebP 后上传 / Convert HEIC/HEIF to JPG, PNG or WebP before uploading.",
    );
}

export function assertSupportedWebImage(file: Pick<File, "type" | "name">) {
  rejectHeic(file);
  if (
    !(file.type
      ? /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type)
      : /\.(jpe?g|png|webp)$/i.test(file.name))
  )
    throw new Error("请选择 JPG、PNG 或 WebP 图片 / Choose a JPG, PNG or WebP image.");
}

export async function prepareWebImage(file: File, options: WebImageOptions): Promise<File> {
  rejectHeic(file);
  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;
  try {
    let source: CanvasImageSource;
    let sourceWidth: number;
    let sourceHeight: number;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      source = bitmap;
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
    } catch {
      objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      source = image;
      sourceWidth = image.naturalWidth;
      sourceHeight = image.naturalHeight;
    }

    const scale = Math.min(1, options.maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法处理该图片");
    context.drawImage(source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", options.quality),
    );
    if (!blob) throw new Error("无法转换该图片");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}${options.suffix ?? ""}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    throw new Error("无法处理该图片，请选择 JPG、PNG 或 WebP 格式");
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// Dedicated PNG path for equipment: JPEG conversion would destroy cutout alpha.
export async function prepareGearPhoto(file: File) {
  assertSupportedWebImage(file);
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("请选择不超过 10MB 的装备图片 / Choose an image up to 10MB.");
  let bitmap: ImageBitmap | null = null,
    objectUrl: string | null = null;
  try {
    let source: CanvasImageSource, width: number, height: number;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      source = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
    }
    if (!width || !height || width * height > 40_000_000) throw new Error("Image too large");
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const encode = async (suffix: string) => {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || blob.size > 10 * 1024 * 1024) throw new Error("PNG too large");
      return new File([blob], `gear${suffix}.png`, {
        type: "image/png",
        lastModified: file.lastModified,
      });
    };
    const original = await encode("-original");
    const { removeLightBackground } = await import("./gear-background");
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = removeLightBackground(data.data, canvas.width, canvas.height);
    if (result.status === "removed") {
      data.data.set(result.pixels);
      context.putImageData(data, 0, 0);
      return { original, cutout: await encode("-cutout"), status: result.status };
    }
    return { original, cutout: null, status: result.status };
  } catch {
    throw new Error(
      "无法处理该图片，请使用不超过 10MB 的 JPG、PNG 或 WebP / Use a JPG, PNG or WebP image up to 10MB.",
    );
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
