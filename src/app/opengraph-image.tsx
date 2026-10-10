import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = '小黑书 - 加拿大华人生活社区';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 字体：Noto Sans SC Bold 的子集（只包含这张图用到的字，约 26KB，SIL OFL 开源协议）
// 如果修改下面的文字，需要重新生成子集，见 src/assets/fonts/README.md
export default async function OpengraphImage() {
  const font = await readFile(join(process.cwd(), 'src/assets/fonts/NotoSansSC-Bold-og-subset.otf'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #f43f5e 0%, #f97316 100%)',
          color: 'white',
          fontFamily: 'NotoSansSC',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 30,
              background: 'white',
              color: '#f43f5e',
              fontSize: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            黑
          </div>
          <div style={{ fontSize: 96, letterSpacing: 4 }}>小黑书</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 64 }}>加拿大华人生活社区</div>
          <div style={{ fontSize: 38, opacity: 0.92 }}>多伦多租房 · 留学 · 移民 · 买房 · 找工作 · 美食探店</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 32, opacity: 0.9 }}>
          <div>xiaoheishu.ca</div>
          <div>枫叶之国 · 大多伦多 GTA</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'NotoSansSC', data: font, style: 'normal', weight: 700 }],
    },
  );
}
