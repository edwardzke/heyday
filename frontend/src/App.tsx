import "./index.css";

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-6 py-16 text-slate-50">
      <section className="flex max-w-xl flex-col items-start gap-3 rounded-2xl bg-slate-900/80 p-8 shadow-lg ring-1 ring-slate-800">
        <span className="text-sm uppercase tracking-[0.35em] text-slate-400">
          Heyday
        </span>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">
          Tailwind + TypeScript shell
        </h1>
        <p className="text-base text-slate-300">
          Start crafting your shared UI components here. Use this surface to debug
          calls to the Django backend at <code>/api</code> or to embed Unity WebGL
          previews when ready.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://vitejs.dev"
            className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            Vite docs
          </a>
          <a
            href="https://tailwindcss.com/docs/installation"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-700 hover:text-white hover:ring-slate-500"
          >
            Tailwind docs
          </a>
        </div>
      </section>
    </main>
  );
}

export default App;
