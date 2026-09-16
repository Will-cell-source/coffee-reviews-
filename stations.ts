// One entry per QR sticker. The key is the URL segment: /s/espresso
// Add a station here, print a sticker, done.
export const STATIONS = {
  espresso: { label: "Espresso bar", method: "espresso" },
  cupping: { label: "Cupping table", method: "cupping" },
  brew: { label: "Brew bar", method: "filter" },
} as const;

export type StationKey = keyof typeof STATIONS;

export function isStation(k: string): k is StationKey {
  return Object.prototype.hasOwnProperty.call(STATIONS, k);
}
