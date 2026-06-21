export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <main className="flex flex-col items-center gap-8 px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          FinTrack
        </h1>
        <p className="max-w-md text-xl text-zinc-600 dark:text-zinc-400">
          Personal finance tracking &amp; bill splitting.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Coming Soon
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to Dashboard
        </a>
      </main>
    </div>
  );
}
