/**
 * 新帖子允许的图片引用：
 * - 本站 Cloudinary 账号的图片：https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/...
 *   （未配置 CLOUDINARY_CLOUD_NAME 时接受任意 res.cloudinary.com 图片）
 * - 本站相对路径：/images/...
 *
 * - ALLOWED_IMAGE_HOSTS（可选，逗号分隔）里列出的其它 https 图片域名
 *
 * 旧数据（Google Drive fileId、外链 URL）仍然可以正常显示，只是新帖不再接受。
 */

const SITE_RELATIVE_IMAGE = /^\/images\/[A-Za-z0-9._\-/]+$/;

function extraAllowedHosts(): string[] {
  return String(process.env.ALLOWED_IMAGE_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/** 宽松检查：只要求是 https 外链（给 API_BOT_SECRET 机器人做兼容用）。 */
export function isHttpsImageUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password && value.length <= 1000;
  } catch {
    return false;
  }
}

/**
 * API_BOT_SECRET 机器人是否允许使用任意 https 外链图片。
 * 默认 true（兼容现有机器人）；设置 API_BOT_ALLOW_EXTERNAL_IMAGES=false 后同样只允许 Cloudinary。
 */
export function botMayUseExternalImages(): boolean {
  return String(process.env.API_BOT_ALLOW_EXTERNAL_IMAGES || '').trim().toLowerCase() !== 'false';
}

export function isAllowedImageRef(value: string): boolean {
  const ref = value.trim();
  if (!ref || ref.length > 1000) {
    return false;
  }

  if (SITE_RELATIVE_IMAGE.test(ref) && !ref.includes('..')) {
    return true;
  }

  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return false;
  }

  if (extraAllowedHosts().includes(url.hostname.toLowerCase())) {
    return true;
  }

  if (url.hostname !== 'res.cloudinary.com') {
    return false;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (cloudName) {
    return url.pathname.startsWith(`/${cloudName}/`);
  }
  return true;
}

/** 生产环境（Vercel 或 NODE_ENV=production）默认禁止写本地磁盘，除非显式设置 ALLOW_LOCAL_UPLOAD_FALLBACK=true。 */
export function isLocalUploadFallbackAllowed(): boolean {
  const override = String(process.env.ALLOW_LOCAL_UPLOAD_FALLBACK || '').trim().toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  return !isProduction;
}

/** 严格检查：只允许本站 Cloudinary 账号的 https 图片（维护接口用）。 */
export function isCloudinaryImageUrl(value: string): boolean {
  const ref = value.trim();
  if (!ref || ref.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port) {
    return false;
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  return cloudName ? url.pathname.startsWith(`/${cloudName}/`) : true;
}

/**
 * 把各种常见的 images 输入整理成字符串数组：
 * - 正常的 JSON 数组：["https://a.jpg", "https://b.jpg"]
 * - 误传成 JSON 字符串：'["https://a.jpg","https://b.jpg"]'
 * - 误传成逗号/换行拼接的字符串："https://a.jpg,https://b.jpg"
 *
 * 只在“逗号/换行后面紧跟 http(s):// 或 /”的位置切分，
 * 所以 Cloudinary 变换参数里的逗号（如 /upload/c_fill,w_400/xxx.jpg）不会被切断。
 * 无法识别的输入原样返回，交给后续校验报错。
 */
export function normalizeImageInput(value: unknown): unknown {
  const splitJoined = (text: string): string[] =>
    text
      .split(/[\s,，]*[\n,，][\s]*(?=https?:\/\/|\/)/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return normalizeImageInput(parsed);
      } catch {
        // 不是合法 JSON，按拼接字符串处理
      }
    }
    return splitJoined(trimmed);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === 'string' ? splitJoined(item) : [item]));
  }

  return value;
}
