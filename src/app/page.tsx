import Avatar from "@/components/Avatar";
import { memberColor } from "@/lib/members";
import CreateHuddle from "./CreateHuddle";
import DemoButton from "./DemoButton";

// recorded production run, 10 Oct 2026 (/h/i8iiiqdb)
const PEOPLE = ["Grandma Lan", "Minh", "Linh", "Mai"];
const example = [
  { label: "A simple average picks", name: "Kawa Sake Sushi Boat", v: [37, 68, 72, 74], fair: false },
  { label: "TasteBridge picks", name: "The Moat", v: [57, 66, 66, 57], fair: true },
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
    body: "Every score is computed from Qloo data, and the exact requests are listed. Claude writes the words, never the numbers.",
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
            <DemoButton variant="secondary" label="Demo: four friends, one movie" />
          </div>
          <a href="#start" className="mt-3 inline-block font-medium text-brand underline-offset-4 hover:underline">
            Or start your own huddle
          </a>
        </div>

        <figure className="rounded-3xl border border-line bg-card p-5 sm:p-6">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-display text-lg font-semibold">Sunday lunch, three generations</span>
            <span className="text-xs text-muted">a real run on live Qloo data</span>
          </figcaption>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {example.map((o) => (
              <div key={o.name} className={`rounded-2xl p-3 ${o.fair ? "bg-accent/15" : "bg-soft"}`}>
                <p className="text-xs text-muted">{o.label}</p>
                <p className="mt-0.5 min-h-[2.5rem] text-sm font-semibold leading-tight">{o.name}</p>
                <div className="mt-3 flex h-28 items-end gap-2" role="img" aria-label={PEOPLE.map((n, i) => `${n} ${o.v[i]}%`).join(", ")}>
                  {o.v.map((v, i) => (
                    <div key={PEOPLE[i]} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <span className={`text-[11px] tabular-nums ${!o.fair && i === 0 ? "font-semibold text-foreground" : "text-muted"}`}>{v}</span>
                      <div
                        className="w-full rounded-t-md"
                        style={{ height: `${v}%`, background: memberColor(i), opacity: !o.fair && i !== 0 ? 0.45 : 1 }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-2">
                  {PEOPLE.map((n, i) => (
                    <span key={n} className="flex flex-1 justify-center">
                      <Avatar name={n} color={memberColor(i)} size="sm" />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            The average leaves Grandma Lan at 37%. The fair pick lifts her to 57%, and nobody ends up lower than that.
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
