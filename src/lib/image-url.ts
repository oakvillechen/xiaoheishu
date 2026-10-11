/**
 * Cloudinary 缩略图（客户端 / 服务端通用）。
 * 只处理 res.cloudinary.com 的 /image/upload/ 地址：在 upload/ 后插入一段变换，
 * 其它图片（站内路径、旧的外链）原样返回。Cloudinary 免费额度内即可使用。
 */
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;

export function isCloudinaryUploadUrl(url: string | null | undefined): boolean {
  return Boolean(url && CLOUDINARY_UPLOAD.test(url));
}

export function cloudinaryThumb(url: string, width: number, extra = 'c_limit,q_auto,f_auto'): string {
  const m = url.match(CLOUDINARY_UPLOAD);
  if (!m) return url;
  return `${m[1]}${extra},w_${Math.round(width)}/${m[2]}`;
}

/** 生成 srcSet；非 Cloudinary 图片返回 undefined */
export function cloudinarySrcSet(url: string, widths: number[] = [240, 360, 480, 720]): string | undefined {
  if (!isCloudinaryUploadUrl(url)) return undefined;
  return widths.map((w) => `${cloudinaryThumb(url, w)} ${w}w`).join(', ');
}

/** fl_getinfo：返回原图宽高的 JSON（只对 Cloudinary 有效） */
export function cloudinaryInfoUrl(url: string): string | null {
  const m = url.match(CLOUDINARY_UPLOAD);
  return m ? `${m[1]}fl_getinfo/${m[2]}` : null;
}
