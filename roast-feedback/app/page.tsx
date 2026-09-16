import Link from "next/link";
import { STATIONS } from "@/lib/stations";

export default function Index() {
  return (
    <main className="screen">
      <h1 className="ask">Tasting notes</h1>
      <p className="hint">
        These are the station links. Print one QR code per station — staff never
        come here.
      </p>
      <div className="index">
        {Object.entries(STATIONS).map(([key, s]) => (
          <Link key={key} href={`/s/${key}`} className="whoami">
            {s.label} — /s/{key}
          </Link>
        ))}
      </div>
    </main>
  );
}
