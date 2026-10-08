import CreateHuddle from "./CreateHuddle";

const steps = [
  { n: "1", title: "Start a huddle", body: "Dinner spot, movie or show. Add any must-haves, like “one vegetarian, under $$$”." },
  { n: "2", title: "Everyone adds 3 favourites", body: "Films, artists, shows, books: anything. Qloo maps taste across domains." },
  { n: "3", title: "Get one fair pick", body: "The agent protects the least-happy person, and shows each friend why it fits them." },
];

export default function Home() {
  return (
    <div className="pt-8 sm:pt-14">
      <section className="max-w-xl">
        <p className="text-sm font-medium text-brand">For friends, couples and families</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
          Stop arguing about where to eat.
        </h1>
        <p className="mt-4 text-lg text-muted">
          TasteBridge finds the one option your <em>whole</em> group will enjoy, not just the loudest voice, and
          explains the trade-off in plain words.
        </p>
      </section>

      <div className="mt-8 grid gap-6 sm:grid-cols-[1.2fr_1fr] items-start">
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
    </div>
  );
}
