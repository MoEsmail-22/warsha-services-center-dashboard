import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY;

const markerIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:24px;height:24px;border:4px solid white;border-radius:9999px;background:#0f766e;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapClickHandler({ onPositionChange }) {
  useMapEvents({
    click(event) {
      onPositionChange(event.latlng);
    },
  });

  return null;
}

/**
 * Leaflet measures its box only once. If the box changes size afterwards (the modal
 * finishing its layout, a scrollbar appearing, the screen resizing), only part of the
 * map gets tiles and the rest stays gray — so measure again on every size change.
 */
function MapResizeWatcher() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function MapViewUpdater({ position }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(position, map.getZoom());
  }, [map, position]);

  return null;
}

/**
 * Leaflet implementation lives in its own lazy-loaded file so its JavaScript,
 * CSS, and map tiles are requested only after the location modal is opened.
 */
export default function LeafletLocationMap({ position, onPositionChange, missingLayerMessage }) {
  const tileUrl = MAPTILER_API_KEY
    ? `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = MAPTILER_API_KEY
    ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

  return (
    <div className="relative">
      {!MAPTILER_API_KEY && missingLayerMessage && (
        <p className="absolute top-3 right-3 left-12 z-[1000] rounded-lg bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-800 shadow">
          {missingLayerMessage}
        </p>
      )}

      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom
        className="h-[300px] w-full rounded-xl sm:h-[380px]"
      >
        <TileLayer
          attribution={attribution}
          url={tileUrl}
          minZoom={1}
          // OpenStreetMap has no tiles past zoom 19; going further shows a gray map.
          maxZoom={MAPTILER_API_KEY ? 20 : 19}
          crossOrigin
        />
        <MapResizeWatcher />
        <MapClickHandler onPositionChange={onPositionChange} />
        <MapViewUpdater position={position} />
        <Marker
          position={position}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend(event) {
              onPositionChange(event.target.getLatLng());
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
