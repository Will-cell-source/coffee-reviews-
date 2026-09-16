import { notFound } from "next/navigation";
import { STATIONS, isStation } from "@/lib/stations";
import ReviewForm from "./review-form";

export default function StationPage({ params }: { params: { station: string } }) {
  if (!isStation(params.station)) notFound();

  // No database call here, so the page is static and opens instantly.
  return (
    <ReviewForm
      station={params.station}
      stationLabel={STATIONS[params.station].label}
    />
  );
}
