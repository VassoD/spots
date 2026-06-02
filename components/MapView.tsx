"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { CATEGORY_COLORS } from "@/lib/categorize";
import type { Place } from "@/lib/types";

interface MapViewProps {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function pinIcon(color: string, active: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="atlas-pin-wrap ${active ? "atlas-pin-active" : ""}"><div class="atlas-pin" style="background:${color}"></div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ places }: { places: Place[] }): null {
  const map = useMap();
  useEffect(() => {
    const pts = places
      .filter((p) => p.lat !== null && p.lon !== null)
      .map((p) => [p.lat as number, p.lon as number] as [number, number]);
    if (pts.length === 0) return;
    map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 14 });
  }, [places, map]);
  return null;
}

function FlyToSelected({ places, selectedId }: { places: Place[]; selectedId: string | null }): null {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const place = places.find((p) => p.id === selectedId);
    if (place?.lat != null && place.lon != null) {
      map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [selectedId, places, map]);
  return null;
}

export default function MapView({ places, selectedId, onSelect }: MapViewProps): React.ReactElement {
  const located = useMemo(
    () => places.filter((p) => p.lat !== null && p.lon !== null),
    [places],
  );

  return (
    <MapContainer
      center={[48.8566, 2.3522]}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds places={located} />
      <FlyToSelected places={located} selectedId={selectedId} />
      {located.map((p) => {
        const color = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.Other;
        return (
          <Marker
            key={p.id}
            position={[p.lat as number, p.lon as number]}
            icon={pinIcon(color, p.id === selectedId)}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <Popup>
              <span className="font-display text-base text-[var(--ink)]">{p.name}</span>
              <br />
              <span className="text-xs text-[var(--ink-soft)]">
                {p.category}
                {p.rating ? ` · ★ ${p.rating}` : ""}
              </span>
              <br />
              <span className="text-xs text-[var(--ink-faint)]">{p.address}</span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
