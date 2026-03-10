"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";

const pickupIcon = L.divIcon({
  className: "custom-pickup",
  html: `<div style="width: 18px; height: 18px; background-color: #2563EB; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropoffIcon = L.divIcon({
  className: "custom-dropoff",
  html: `<svg width="36" height="36" viewBox="0 0 24 24" fill="#EA4335" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

function MapUpdater({ pickup, dropoff }: { pickup: any; dropoff: any }) {
  const map = useMap();
  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds([
        [parseFloat(pickup.lat), parseFloat(pickup.lon)],
        [parseFloat(dropoff.lat), parseFloat(dropoff.lon)],
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickup) {
      map.flyTo([parseFloat(pickup.lat), parseFloat(pickup.lon)], 15);
    } else if (dropoff) {
      map.flyTo([parseFloat(dropoff.lat), parseFloat(dropoff.lon)], 15);
    }
  }, [pickup, dropoff, map]);
  return null;
}

function MapClickListener({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function Map({
  pickup,
  dropoff,
  setDistance,
  onMapClick,
}: {
  pickup: any;
  dropoff: any;
  setDistance: (d: string | null) => void;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const defaultCenter: [number, number] = [22.5645, 72.9289];
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute([]);
      setDistance(null);
      return;
    }

    const fetchRoute = async () => {
      try {
        const start = `${pickup.lon},${pickup.lat}`;
        const end = `${dropoff.lon},${dropoff.lat}`;
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`,
        );
        const data = await res.json();

        if (data.routes && data.routes[0]) {
          const coordinates = data.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]],
          );
          setRoute(coordinates);
          const distanceInKm = (data.routes[0].distance / 1000).toFixed(1);
          setDistance(distanceInKm);
        }
      } catch (error) {
        console.error("Error fetching route:", error);
      }
    };

    fetchRoute();
  }, [pickup, dropoff, setDistance]);

  return (
    <div className="w-full h-full z-0 relative">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {onMapClick && <MapClickListener onMapClick={onMapClick} />}
        <MapUpdater pickup={pickup} dropoff={dropoff} />

        {pickup && (
          <Marker
            position={[parseFloat(pickup.lat), parseFloat(pickup.lon)]}
            icon={pickupIcon}
          >
            <Popup>Pickup: {pickup.name}</Popup>
          </Marker>
        )}
        {dropoff && (
          <Marker
            position={[parseFloat(dropoff.lat), parseFloat(dropoff.lon)]}
            icon={dropoffIcon}
          >
            <Popup>Dropoff: {dropoff.name}</Popup>
          </Marker>
        )}

        {route.length > 0 && (
          <Polyline
            positions={route}
            color="	#4285F4"
            weight={5}
            opacity={0.8}
          />
        )}
      </MapContainer>
    </div>
  );
}
