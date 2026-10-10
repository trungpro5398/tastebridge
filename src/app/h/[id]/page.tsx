import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getHuddle } from "@/lib/store";
import HuddleView from "./HuddleView";

export const metadata = {
  description:
    "A TasteBridge huddle: everyone adds three favourites, and an agent on Qloo's taste graph finds one fair pick for the whole group.",
};

export default function HuddlePage(props: PageProps<"/h/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <HuddleLoader params={props.params} />
    </Suspense>
  );
}

async function HuddleLoader({ params }: { params: PageProps<"/h/[id]">["params"] }) {
  const { id } = await params;
  const huddle = await getHuddle(id);
  if (!huddle) notFound();
  return <HuddleView initial={huddle} />;
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6 pt-6" aria-busy>
      <div className="h-4 w-32 rounded bg-soft" />
      <div className="h-9 w-2/3 rounded bg-soft" />
      <div className="h-48 rounded-2xl bg-soft" />
      <div className="h-14 rounded-2xl bg-soft" />
    </div>
  );
}
