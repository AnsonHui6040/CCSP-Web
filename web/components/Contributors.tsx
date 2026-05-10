const CONTRIBUTORS = [
  {
    name: "AnsonHui6040",
    href: "https://github.com/AnsonHui6040",
  },
  {
    name: "MrLongMo",
    href: "https://github.com/MrLongMo",
  },
] as const;

type Props = {
  className?: string;
};

export function Contributors({ className = "" }: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--color-text-dim)] ${className}`}
      aria-label="GitHub contributors"
    >
      <span className="hidden sm:inline">共同製作</span>
      {CONTRIBUTORS.map((person) => (
        <a
          key={person.href}
          href={person.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded border bg-[color:var(--color-surface-2)] px-2.5 transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
        >
          <GitHubIcon />
          <span>{person.name}</span>
        </a>
      ))}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-current"
    >
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.71 0 0 .84-.28 2.75 1.05A9.34 9.34 0 0 1 12 7c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.4.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}
