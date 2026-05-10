import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-4xl font-bold tracking-tight">CCSP Web</h1>
      <p className="mt-2 text-[color:var(--color-text-dim)]">
        Course Choice &amp; Schedule Planner — 東海大學選課規劃平台
      </p>
      <div className="mt-10 grid gap-4">
        <Link
          href="/courses"
          className="rounded-lg border bg-[color:var(--color-surface)] p-5 transition hover:border-[color:var(--color-accent)]"
        >
          <div className="text-lg font-semibold">課程搜尋</div>
          <div className="text-sm text-[color:var(--color-text-dim)]">
            搜尋、篩選、加入候選池
          </div>
        </Link>
        <Link
          href="/schedule"
          className="rounded-lg border bg-[color:var(--color-surface)] p-5 transition hover:border-[color:var(--color-accent)]"
        >
          <div className="text-lg font-semibold">課表預排</div>
          <div className="text-sm text-[color:var(--color-text-dim)]">
            預排模式、衝堂分析、學分統計、空堂分析
          </div>
        </Link>
      </div>
    </main>
  );
}
