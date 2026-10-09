import Avatar from "@/components/Avatar";
import { memberColor } from "@/lib/members";
import CreateHuddle from "./CreateHuddle";
import DemoButton from "./DemoButton";

const example = [
  { name: "Mai", v: 79, why: "Amélie, Norah Jones" },
  { name: "Josh", v: 68, why: "John Wick, Mad Max" },
  { name: "Priya", v: 100, why: "The Bear, Salt Fat Acid Heat" },
  { name: "Leo", v: 74, why: "Severance, Radiohead" },
];

const steps = [
  {
    title: "Start a huddle and share the link",
    body: "Dinner spot, movie or TV show. Add must-haves like “one vegetarian, under $$$”.",
  },
  {
    title: "Everyone adds three favourites",
    body: "A film, a show, an artist, a book. Qloo’s taste graph connects them to restaurants and titles.",
  },
  {
    title: "Get one pick that leaves nobody behind",
    body: "The agent scores every option for every person, then picks the one with the best lowest match.",
  },
];

const why = [
  {
    title: "Fair, not loudest",
    body: "Averages hide the person who hates the choice. TasteBridge lifts the lowest match first and shows what the average would have done.",
  },
  {
    title: "Shows its working",
    body: "Each score comes from Qloo, with the favourite that drove it and the exact requests made. Claude writes the words, never the numbers.",
  },
  {
    title: "Taste, not questionnaires",
    body: "Nobody fills in cuisine checkboxes. Loving Spirited Away and Norah Jones is enough to place you.",
  },
];

export default function Home() {
  return (
    <div className="space-y-20 pt-10 sm:pt-16">
      <section className="grid items-center gap-10 sm:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl">
            Four friends, four tastes, one fair pick.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Everyone adds three favourite films, shows or artists. An agent asks Qloo&apos;s taste graph what the whole
            group will like, and picks the dinner spot or movie that leaves nobody behind.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <DemoButton />
            <a href="#start" className="rounded-xl px-4 py-3 font-medium text-brand hover:bg-soft">
              Start your own
            </a>
          </div>
        </div>

        <figure className="rounded-3xl border border-line bg-card p-5 shadow-[0_24px_60px_-30px_rgba(91,42,134,0.45)]">
          <figcaption className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-brand">Example fair pick</span>
            <span className="text-xs text-muted">live Qloo data, Melbourne</span>
          </figcaption>
          <p className="mt-2 font-display text-2xl font-semibold">Archie&apos;s All Day</p>
          <p className="text-sm text-muted">Fitzroy, $$. Brunch, welcoming.</p>
          <ul className="mt-4 space-y-2.5">
            {example.map((p, i) => (
              <li key={p.name} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${p.name === "Josh" ? "bg-accent/15" : ""}`}>
                <Avatar name={p.name} color={memberColor(i)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="tabular-nums">{p.v}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-soft">
                    <div className="h-full rounded-full" style={{ width: `${p.v}%`, background: memberColor(i) }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            A simple average would choose Chotto Motto, where Josh drops to 58%. TasteBridge keeps everyone at 68% or
            more.
          </p>
        </figure>
      </section>

      <section id="how" className="scroll-mt-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="font-display text-4xl font-semibold text-brand">{i + 1}</span>
              <p className="mt-2 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl bg-brand p-6 text-brand-ink sm:p-10">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Why groups trust the pick</h2>
        <p className="mt-2 max-w-2xl opacity-80">
          We ran 60 random groups through live Qloo data. In 37% of them, a simple average would have picked something
          one person matched poorly. TasteBridge&apos;s pick lifted that person by 21 points on average.
        </p>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          {why.map((w) => (
            <div key={w.title}>
              <dt className="font-semibold">{w.title}</dt>
              <dd className="mt-1 text-sm opacity-80">{w.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="start" className="scroll-mt-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Start a huddle</h2>
        <p className="mt-1 text-muted">Takes ten seconds. You&apos;ll get a link and a QR code to share.</p>
        <div className="mt-6 max-w-xl">
          <CreateHuddle />
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        Taste matches use Qloo&apos;s audience-level affinities: they describe what people with similar tastes tend to
        like, not a prediction about any one person. No personal data is sent to Qloo. Built for the Qloo Agentic
        Hackathon.{" "}
        <a className="underline" href="https://github.com/trungpro5398/tastebridge">
          Source on GitHub
        </a>
        , MIT licence.
      </footer>
    </div>
  );
}
