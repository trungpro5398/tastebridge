import Avatar from "@/components/Avatar";
import { memberColor } from "@/lib/members";
import CreateHuddle from "./CreateHuddle";
import DemoButton from "./DemoButton";

const example = [
  { name: "Grandma Lan", v: 57 },
  { name: "Minh", v: 66 },
  { name: "Linh", v: 66 },
  { name: "Mai", v: 57 },
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
    body: "Every score is computed from Qloo data, with the exact requests listed and the favourite behind a match when one clearly stands out. Claude writes the words, never the numbers, and can't describe a vibe Qloo doesn't tag.",
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
            Everyone&apos;s taste on the table. One fair pick.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Everyone adds three favourite films, shows or artists. An agent asks Qloo&apos;s taste graph what the whole
            group will like, and picks the dinner spot or movie that leaves nobody behind.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <DemoButton scenario="family" label="Demo: three generations, one lunch" />
            <DemoButton variant="secondary" label="Demo: four friends, Friday dinner" />
          </div>
          <a href="#start" className="mt-3 inline-block font-medium text-brand underline-offset-4 hover:underline">
            Or start your own huddle
          </a>
        </div>

        <figure className="rounded-3xl border border-line bg-card p-5 shadow-[0_24px_60px_-30px_rgba(91,42,134,0.45)]">
          <figcaption className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-brand">Example fair pick</span>
            <span className="text-xs text-muted">live Qloo data, Melbourne</span>
          </figcaption>
          <p className="mt-2 font-display text-2xl font-semibold">The Moat</p>
          <p className="text-sm text-muted">Melbourne CBD, $$. Sunday lunch for three generations.</p>
          <ul className="mt-4 space-y-2.5">
            {example.map((p, i) => (
              <li key={p.name} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${p.name === "Grandma Lan" ? "bg-accent/15" : ""}`}>
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
            A simple average would choose Kawa Sake Sushi Boat, where Grandma Lan drops to 37%. TasteBridge keeps
            everyone at 57% or more.
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
        <h2 className="font-display text-3xl font-semibold tracking-tight">Tested on 120 random groups</h2>
        <p className="mt-2 max-w-2xl opacity-80">
          We ran 120 random groups through live Qloo data. In 40% of them, the fair pick differed from what a simple
          average would choose. There, the least-matched person with a clear preference gained 14 points, for a 7-point drop in the
          group average. Real groups&apos; results appear on the Impact page as they come in.
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

      <section className="grid gap-8 sm:grid-cols-[1fr_1.1fr] sm:items-center">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">For teams and platforms</h2>
          <p className="mt-2 text-muted">
            Team dinners, offsites, group trips and shared nights out have the same problem at a bigger scale. Booking,
            ticketing and travel platforms can call the same fair-pick engine directly: no AI cost per call, a few Qloo
            lookups, and every result comes with its evidence.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li>Team-dinner and offsite tools: one venue the whole team can live with</li>
            <li>Ticketing and events: shows a group of friends will all enjoy</li>
            <li>Group travel: restaurants and activities for mixed-taste groups</li>
          </ul>
          <a
            href="https://github.com/trungpro5398/tastebridge/blob/main/docs/API.md"
            className="mt-4 inline-block font-medium text-brand underline-offset-4 hover:underline"
          >
            Read the API docs
          </a>
        </div>
        <pre className="overflow-x-auto rounded-3xl bg-foreground p-5 text-xs leading-relaxed text-background">
{`POST /api/v1/fair-pick
{
  "kind": "place",
  "location": "Melbourne",
  "members": [
    { "name": "Ana", "favourites": ["Amélie"] },
    { "name": "Ben", "favourites": ["John Wick"] }
  ]
}

→ { "pick": { "name": "Archie's All Day",
              "meta": "Fitzroy · $$",
              "lowest_match": 0.544, ... },
    "simple_average_pick": { ... },
    "provenance": { "qloo": "live",
                    "calls": [ 7 requests ] } }`}
        </pre>
      </section>

      <section id="start" className="scroll-mt-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Start a huddle</h2>
        <p className="mt-1 text-muted">Takes ten seconds. You&apos;ll get a link and a QR code to share.</p>
        <div className="mt-6 max-w-xl">
          <CreateHuddle />
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        Taste matches come from Qloo and describe what people with similar tastes tend to like, not a prediction about
        any one person. No personal data is sent to Qloo. Built for the Qloo Agentic
        Hackathon.{" "}
        <a className="underline" href="https://github.com/trungpro5398/tastebridge">
          Source on GitHub
        </a>
        , MIT licence.
      </footer>
    </div>
  );
}
