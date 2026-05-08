import Link from "next/link";

type Props = {
  active?: "courses" | "schedule";
};

export function Navbar({ active }: Props) {
  return (
    <nav className="border-b bg-[color:var(--color-surface)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight hover:text-[color:var(--color-accent)]"
        >
          CCSP <span className="text-[color:var(--color-text-dim)]">·</span>{" "}
          東海選課規劃
        </Link>
        <div className="flex gap-1.5 text-sm">
          <NavLink href="/courses" active={active === "courses"}>
            課程搜尋
          </NavLink>
          <NavLink href="/schedule" active={active === "schedule"}>
            我的課表
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded border px-3 py-1 transition ${
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
          : "border-transparent text-[color:var(--color-text-dim)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)]"
      }`}
    >
      {children}
    </Link>
  );
}
