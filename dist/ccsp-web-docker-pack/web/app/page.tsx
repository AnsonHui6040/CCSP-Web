import Link from "next/link";
import { Contributors } from "@/components/Contributors";

const TUTORIAL_STEPS = [
  {
    src: "/tutorial/step-1.png",
    title: "進入課程搜尋",
    text: "確認目前學期，輸入課程名稱、教師或選課代碼開始查找。",
  },
  {
    src: "/tutorial/step-2.png",
    title: "篩選並加入候選",
    text: "使用左側條件縮小範圍，看到想保留的課程即可加入候選。",
  },
  {
    src: "/tutorial/step-3.png",
    title: "查看課程詳細",
    text: "進入詳細頁確認教師、學分、名額、備註與限制。",
  },
  {
    src: "/tutorial/step-4.png",
    title: "預排我的課表",
    text: "在預排模式比較課程安排，搭配右側分頁整理候選與衝堂。",
  },
  {
    src: "/tutorial/step-5.png",
    title: "切換正式模式並匯出",
    text: "完成安排後切到正式模式，匯出 PNG、PDF 或分享連結。",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">CCSP Web</h1>
          <p className="mt-2 text-[color:var(--color-text-dim)]">
            Course Choice &amp; Schedule Planner — 東海大學選課規劃平台
          </p>
        </div>
        <Contributors />
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
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

      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">使用教學</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-dim)]">
              由搜尋、候選、詳細確認到課表匯出，一次看懂主要流程。
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {TUTORIAL_STEPS.map((step, index) => (
            <article
              key={step.src}
              className={index === 0 ? "md:col-span-2" : undefined}
            >
              <div className="overflow-hidden rounded-lg border bg-[color:var(--color-surface)]">
                <img
                  src={step.src}
                  alt={`CCSP Web 使用教學：${step.title}`}
                  className="aspect-video w-full object-cover"
                />
                <div className="p-4">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-[color:var(--color-text-dim)]">
                    {step.text}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
