import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

/**
 * With a Geoapify key: their "OSM Bright" map (cleaner, Google-like), sharp on retina
 * screens ({r} becomes "@2x"). Without one: OpenStreetMap's free tiles.
 * Both show shops, workshops and other places from about zoom 17.
 */
const TILES = GEOAPIFY_API_KEY
  ? {
      url: `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}{r}.png?apiKey=${GEOAPIFY_API_KEY}`,
      attribution: `Powered by <a href="https://www.geoapify.com/">Geoapify</a> | &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ${OSM_ATTRIBUTION}`,
      maxZoom: 20,
    }
  : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: OSM_ATTRIBUTION,
      // OpenStreetMap has no tiles past zoom 19; going further shows a gray map.
      maxZoom: 19,
    };

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

/** Moves the map to the pin. A position with `zoom` (a search result) also zooms in. */
function MapViewUpdater({ position }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(position, position.zoom ?? map.getZoom());
  }, [map, position]);

  return null;
}

/**
 * Leaflet implementation lives in its own lazy-loaded file so its JavaScript,
 * CSS, and map tiles are requested only after the location modal is opened.
 */
export default function LeafletLocationMap({ position, onPositionChange }) {
  return (
    <div className="relative">
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom
        className="h-[300px] w-full rounded-xl sm:h-[380px]"
      >
        <TileLayer
          attribution={TILES.attribution}
          url={TILES.url}
          minZoom={1}
          maxZoom={TILES.maxZoom}
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
