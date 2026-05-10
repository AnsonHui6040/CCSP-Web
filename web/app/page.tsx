import Link from "next/link";
import { Contributors } from "@/components/Contributors";

const TUTORIAL_STEPS = [
  {
    src: "/tutorial/step-1.png",
  },
  {
    src: "/tutorial/step-2.png",
  },
  {
    src: "/tutorial/step-3.png",
  },
  {
    src: "/tutorial/step-4.png",
  },
  {
    src: "/tutorial/step-5.png",
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
          </div>
        </div>

        <div className="grid gap-6">
          {TUTORIAL_STEPS.map((step, index) => (
            <article key={step.src}>
              <div className="overflow-hidden rounded-lg border bg-[color:var(--color-surface)]">
                <img
                  src={step.src}
                  alt={`CCSP Web 使用教學 Step ${index + 1}`}
                  className="w-full"
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
