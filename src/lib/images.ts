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
