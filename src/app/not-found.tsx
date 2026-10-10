import Link from 'next/link';

export const metadata = { title: '页面不存在', robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold text-rose-500">404</p>
      <h1 className="text-lg font-semibold text-slate-800">这个页面不存在，或者帖子已经被删除</h1>
      <Link href="/" className="rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600">
        回到小黑书首页
      </Link>
    </main>
  );
}
