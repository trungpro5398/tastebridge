import CreateHuddle from "./CreateHuddle";
import DemoButton from "./DemoButton";

const steps = [
  { n: "1", title: "Start a huddle", body: "Dinner spot, movie or show. Add must-haves like “one vegetarian, under $$$”." },
  { n: "2", title: "Everyone adds 3 favourites", body: "Films, artists, shows, books: anything. Qloo connects taste across domains." },
  { n: "3", title: "Get one fair pick", body: "The agent protects whoever has the lowest taste match and shows the evidence." },
];

const why = [
  {
    icon: "⚖️",
    title: "Fair by design",
    body: "Picks the option that lifts the lowest taste match in the group, then shows what a simple average would have done.",
  },
  {
    icon: "🔍",
    title: "Shows its working",
    body: "Every score comes from Qloo, with the exact requests and the favourite that drove each match. No made-up numbers.",
  },
  {
    icon: "🎧",
    title: "Taste, not surveys",
    body: "Love Spirited Away and Norah Jones? Qloo turns that into a dinner match. No questionnaires, no cuisine checkboxes.",
  },
];

const preview = [
  { name: "Mai", v: 67, why: "Norah Jones, Spirited Away" },
  { name: "Josh", v: 47, why: "Daft Punk" },
  { name: "Priya", v: 80, why: "Salt Fat Acid Heat" },
  { name: "Leo", v: 100, why: "Radiohead" },
];

export default function Home() {
  return (
    <div className="space-y-16 pt-8 sm:pt-14">
      <section className="grid items-center gap-10 sm:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-medium text-brand">For friends, couples and families</p>
          <h1 className="mt-2 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Stop arguing about where to eat.
          </h1>
          <p className="mt-4 text-lg text-muted">
            Everyone adds three favourite films, shows or artists. TasteBridge&apos;s agent asks Qloo&apos;s taste graph
            what the <em>whole</em> group will like, and picks the option that leaves nobody behind.
          </p>
          <div className="mt-6 flex flex-wrap items-start gap-3">
            <DemoButton />
            <a href="#start" className="rounded-xl border border-line px-5 py-3 font-medium hover:bg-soft">
              Start your own
            </a>
          </div>
        </div>

        <div aria-hidden className="rotate-1 rounded-2xl border border-line bg-card shadow-lg">
          <div className="flex justify-between rounded-t-2xl bg-brand/10 px-5 py-2 text-xs font-medium uppercase tracking-wider text-brand">
            <span>Tonight&apos;s fair pick</span>
            <span className="text-muted normal-case tracking-normal">Example</span>
          </div>
          <div className="p-5">
            <p className="text-lg font-semibold">The Green Fig</p>
            <p className="text-sm text-muted">Vegetarian-friendly · $$ · everyone ≥ 47%</p>
            <div className="mt-4 space-y-2.5">
              {preview.map((p) => (
                <div key={p.name}>
                  <div className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    <span className="tabular-nums text-muted">{p.v}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-soft">
                    <div
                      className={`h-full rounded-full ${p.v >= 70 ? "bg-accent" : "bg-amber-500"}`}
                      style={{ width: `${p.v}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">driven by {p.why}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-soft p-3 text-xs text-muted">
              A simple average would pick the Board Game Pantry, but Josh&apos;s match there is only 33%.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {why.map((w) => (
          <div key={w.title} className="rounded-2xl border border-line bg-card p-5">
            <p className="text-2xl">{w.icon}</p>
            <p className="mt-2 font-medium">{w.title}</p>
            <p className="mt-1 text-sm text-muted">{w.body}</p>
          </div>
        ))}
      </section>

      <section id="start" className="scroll-mt-6">
        <h2 className="text-2xl font-semibold tracking-tight">Start a huddle</h2>
        <div className="mt-5 grid items-start gap-6 sm:grid-cols-[1.2fr_1fr]">
          <CreateHuddle />
          <ol className="space-y-4">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="mt-0.5 inline-grid size-7 shrink-0 place-items-center rounded-full bg-soft text-sm font-semibold">
                  {s.n}
                </span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-xs text-muted">
        Taste matches use Qloo&apos;s audience-level affinities: they describe what people with similar tastes tend to
        like, not a prediction about any one person. No personal data is sent to Qloo.{" "}
        <a className="underline" href="https://github.com/trungpro5398/tastebridge">Source on GitHub</a> · MIT
      </footer>
    </div>
  );
}
