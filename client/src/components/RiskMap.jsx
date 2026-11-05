import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LEVEL_COLORS, fmt } from '../lib.js';

export default function RiskMap({ scores, onSelect }) {
  const lats = scores.map((r) => r.lat);
  const lngs = scores.map((r) => r.lng);
  const bounds = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];

  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [40, 40] }} minZoom={2} scrollWheelZoom={false} className="map">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {scores.map((r) => (
        <CircleMarker
          key={r.regionId}
          center={[r.lat, r.lng]}
          radius={9 + r.score * 16}
          pathOptions={{ color: LEVEL_COLORS[r.level], fillColor: LEVEL_COLORS[r.level], fillOpacity: 0.55, weight: 2 }}
          eventHandlers={{ click: () => onSelect && onSelect(r.regionId) }}
        >
          <Tooltip>
            <strong>{r.name}</strong>
            <br />
            Score {fmt(r.score)} · {r.level}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
