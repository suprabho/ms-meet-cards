import { getEvents } from "@/lib/events";
import CardGenerator from "./CardGenerator";

export default async function Page({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const [events, { event: requested }] = await Promise.all([getEvents(), searchParams]);
  const current = events.find((e) => e.slug === requested) ?? events[0];

  return (
    <main>
      <header>
        <h1>
          <span>Merkle Science Meet</span> Guest Card Generator
        </h1>
        <p>
          {current.edition} · {current.date}
        </p>
      </header>
      <CardGenerator events={events} initialSlug={current.slug} />
      <p className="privacy">
        Your photo never leaves this page. The card is drawn in your browser and the PNG is created on your device —
        nothing is uploaded.
      </p>
    </main>
  );
}
