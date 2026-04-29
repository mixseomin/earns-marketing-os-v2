export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-[--color-mute]">
          Earns Marketing OS
        </div>
        <h1 className="mt-3 text-5xl font-light tracking-tight">
          v2 <span className="text-[--color-accent]">·</span> initializing
        </h1>
        <p className="mt-4 text-sm text-[--color-mute]">
          Knowledge + organization rebuilt from scratch.
        </p>
        <p className="mt-8 text-[10px] font-mono text-[--color-mute]/60">
          {new Date().toISOString().slice(0, 10)} · mos2.on.tc
        </p>
      </div>
    </main>
  );
}
