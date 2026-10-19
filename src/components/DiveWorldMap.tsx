import { useState } from "react";
import countries from "@/lib/world-map.json";

// Natural Earth 1:110m public-domain boundaries, bundled locally.
// Markers indicate the recorded country, not an exact dive-site position.
const aliases: Record<string, string> = { usa: "united states of america", "united states": "united states of america", 印尼: "indonesia", 澳洲: "australia", 帕劳: "palau", "east timor": "timor-leste" };
const islandLocations = [
  { name: "Maldives", aliases: ["马尔代夫", "馬爾代夫", "MV"], x: 506, y: 173.6 },
  { name: "Palau", aliases: ["帕劳", "帛琉", "PW"], x: 628, y: 165 },
  { name: "Singapore", aliases: ["新加坡", "SG"], x: 567.6, y: 177.4 },
  { name: "Seychelles", aliases: ["塞舌尔", "塞席爾", "SC"], x: 471, y: 189.2 },
  { name: "Mauritius", aliases: ["毛里求斯", "模里西斯", "MU"], x: 475, y: 220.4 },
];
const locations = [...countries, ...islandLocations];
const normalize = (value: string) => aliases[value.trim().toLowerCase()] ?? value.trim().toLowerCase();

export function DiveWorldMap({ visits, english }: { visits: string[]; english: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const markers = new Map<string, { name: string; x: number; y: number; count: number }>();
  for (const visit of visits) {
    const key = normalize(visit);
    const location = locations.find((entry) => [entry.name, ...entry.aliases].some((name) => normalize(name) === key));
    if (!location) continue;
    const previous = markers.get(location.name);
    markers.set(location.name, { name: location.name, x: location.x, y: location.y, count: (previous?.count ?? 0) + 1 });
  }
  return <div className="do-dive-world-map">
    <svg viewBox="0 0 720 330" role="img" aria-label={english ? "World map of your diving countries" : "全球潜水足迹地图"}>
      <g className="do-dive-world-grid"><path d="M0 60H720M0 120H720M0 180H720M0 240H720M0 300H720M120 0V330M240 0V330M360 0V330M480 0V330M600 0V330" /></g>
      <g className="do-dive-world-land">{countries.map((country) => <path key={country.name} d={country.path}><title>{country.name}</title></path>)}</g>
      {[...markers.values()].map((marker) => <g key={marker.name} transform={`translate(${marker.x} ${marker.y})`} className="do-dive-world-pin" tabIndex={0} role="button" aria-label={`${marker.name}: ${marker.count} ${english ? "dives" : "次潜水"}`} onClick={() => setActive(marker.name)} onFocus={() => setActive(marker.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActive(marker.name); } }}>
        <title>{marker.name} · {marker.count} {english ? "dives" : "次潜水"}</title><circle r="12" className="do-dive-world-pin-hit" /><circle r="8" className="do-dive-world-pin-halo" /><circle r="3.8" className="do-dive-world-pin-dot" />
      </g>)}
    </svg>
    <div className="do-dive-world-caption"><span><i />{active && markers.has(active) ? `${active} · ${markers.get(active)!.count} ${english ? "dives" : "次潜水"}` : english ? "Red markers show countries visited" : "红色标记为已记录潜水的国家"}</span><small>Natural Earth</small></div>
  </div>;
}
