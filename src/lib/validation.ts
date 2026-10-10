import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isAllowedImageRef, isCloudinaryImageUrl, normalizeImageInput } from '@/lib/image-refs';

/** 统一的长度上限，前后端可共用。 */
export const LIMITS = {
  titleMax: 100,
  contentMax: 5000,
  commentMax: 1000,
  linkMax: 500,
  cityMax: 40,
  tagsMax: 200,
  categoryMax: 40,
  usernameMax: 40,
  imagesMax: 9,
  messageTitleMax: 120,
  messageContentMax: 2000,
} as const;

const optionalTrimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}不能超过 ${max} 个字符`)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const httpLink = z
  .string()
  .trim()
  .max(LIMITS.linkMax, `链接不能超过 ${LIMITS.linkMax} 个字符`)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https?:\/\//i.test(value), '链接必须以 http:// 或 https:// 开头');

const imageRef = z
  .string()
  .trim()
  .refine(isAllowedImageRef, '图片地址不合法：只接受本站上传的图片（Cloudinary）或站内路径');

const postFields = {
  title: z.string().trim().min(1, '标题不能为空').max(LIMITS.titleMax, `标题不能超过 ${LIMITS.titleMax} 个字符`),
  content: z.string().trim().min(1, '正文不能为空').max(LIMITS.contentMax, `正文不能超过 ${LIMITS.contentMax} 个字符`),
  link: httpLink,
  city: optionalTrimmed(LIMITS.cityMax, '城市'),
  tags: optionalTrimmed(LIMITS.tagsMax, '标签'),
  category: optionalTrimmed(LIMITS.categoryMax, '分类'),
};

// 用户发帖：图片先只做基本校验，来源检查在路由里做（机器人兼容模式需要区别对待）
const looseImageRef = z.string().trim().min(1, '图片地址不能为空').max(1000, '图片地址太长');

export const createPostSchema = z.object({
  ...postFields,
  userId: z.string().trim().min(1, '缺少 userId'),
  images: z.preprocess(normalizeImageInput, z.array(looseImageRef).min(1, '请至少上传一张图片').max(LIMITS.imagesMax, `最多 ${LIMITS.imagesMax} 张图片`)),
});

export const agentPublishSchema = z.object({
  ...postFields,
  // 绑定了作者的 Key 会忽略 username，所以这里允许为空，在路由里再判断
  username: z.string().trim().max(LIMITS.usernameMax, `username 不能超过 ${LIMITS.usernameMax} 个字符`).optional().nullable(),
  images: z.preprocess(normalizeImageInput, z.array(imageRef).max(LIMITS.imagesMax, `最多 ${LIMITS.imagesMax} 张图片`).optional().nullable()),
});

const cloudinaryImageRef = z
  .string()
  .trim()
  .refine(isCloudinaryImageUrl, '图片必须是本站 Cloudinary 图片（请先调用 /api/agent/upload 上传）');

/** 维护接口：只允许改 images / title / content，至少要有一项。 */
export const agentAdminPatchSchema = z
  .object({
    title: postFields.title.optional(),
    content: postFields.content.optional(),
    images: z
      .preprocess(
        normalizeImageInput,
        z.array(cloudinaryImageRef).min(1, '至少需要一张图片').max(LIMITS.imagesMax, `最多 ${LIMITS.imagesMax} 张图片`),
      )
      .optional(),
    dryRun: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.title !== undefined || v.content !== undefined || v.images !== undefined, {
    message: '至少要提供 title、content、images 中的一项',
  });

export const createCommentSchema = z.object({
  postId: z.coerce.number().int().positive('postId 不合法'),
  userId: z.string().trim().min(1, '缺少 userId'),
  content: z.string().trim().min(1, '评论不能为空').max(LIMITS.commentMax, `评论不能超过 ${LIMITS.commentMax} 个字符`),
});

export const adminMessageSchema = z.object({
  toUserId: z.string().trim().min(1, '缺少 toUserId'),
  title: z.string().trim().min(1, '标题不能为空').max(LIMITS.messageTitleMax, 'title is too long'),
  content: z.string().trim().min(1, '内容不能为空').max(LIMITS.messageContentMax, 'content is too long'),
});

/** 解析 JSON body 并校验；失败时返回可以直接 return 的 400 响应。 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.join('.') || '';
    return {
      ok: false,
      response: NextResponse.json(
        { error: issue?.message || 'Invalid request body', field },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}
