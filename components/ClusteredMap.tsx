"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import SnapMarker from "./SnapMarker";
import LocateUser from "./LocateUser";
import L from "leaflet";
import { useRef } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const DotIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:18px;height:18px;background:#e11d48;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px #0003;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

const UserLocationIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:18px;height:18px;background:#fff;border-radius:50%;border:2px solid #2563eb;box-shadow:0 0 6px #2563eb99;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

interface Snap {
  id: string;
  user_id: string;
  image_url: string;
  description: string;
  lat: number;
  lng: number;
  created_at: string;
  utilizatori?: {
    name?: string;
    avatar_url?: string;
  };
}

interface ClusteredMapProps {
  snaps: Snap[];
  snapAddresses: { [snapId: string]: string | null };
  userLocation: L.LatLng | null;
  comments: { [snapId: string]: Array<{ id: string; user_id: string; text: string; created_at: string; user_name?: string }> };
  commentInputs: { [snapId: string]: string };
  commentLoading: { [snapId: string]: boolean };
  onCommentInput: (snapId: string, value: string) => void;
  onCommentSubmit: (snapId: string) => void;
  setUserLocation: (latlng: L.LatLng) => void;
  onSnapDetails: (snap: Snap) => void;
}

const ClusteredMap: React.FC<ClusteredMapProps> = ({
  snaps,
  snapAddresses,
  userLocation,
  comments,
  commentInputs,
  commentLoading,
  onCommentInput,
  onCommentSubmit,
  setUserLocation,
  onSnapDetails,
}) => {
  const markerRefs = useRef<(L.Marker | null)[]>([]);
  const mapCenter: [number, number] = [37.7749, -122.4194];
  const mapZoom = 12;

  const clusterMap: { [key: string]: Snap[] } = {};
  snaps.forEach(snap => {
    const key = `${snap.lat.toFixed(3)},${snap.lng.toFixed(3)}`;
    if (!clusterMap[key]) clusterMap[key] = [];
    clusterMap[key].push(snap);
  });

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      scrollWheelZoom={true}
      style={{ height: "100vh", width: "100vw" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocateUser setUserLocation={setUserLocation} />
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={UserLocationIcon}>
          <Popup minWidth={120} closeOnEscapeKey={true}>
            <div className="text-center text-xs font-mono text-blue-700">You are here<br />({userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)})</div>
          </Popup>
        </Marker>
      )}
      {Object.entries(clusterMap).map(([key, snapsInCluster], idx) => {
        const [lat, lng] = key.split(",").map(Number);
        if (snapsInCluster.length === 1) {
          const snap = snapsInCluster[0];
          return (
            <SnapMarker
              key={`marker-${snap.id}`}
              snap={snap}
              idx={idx}
              markerRef={(el) => { markerRefs.current[idx] = el; }}
              icon={DotIcon}
              supabaseUrl={SUPABASE_URL}
              address={snapAddresses[snap.id]}
              comments={comments[snap.id] || []}
              commentInput={commentInputs[snap.id] || ''}
              commentLoading={commentLoading[snap.id]}
              onCommentInput={val => onCommentInput(snap.id, val)}
              onCommentSubmit={() => onCommentSubmit(snap.id)}
            />
          );
        } else {
          return (
            <Marker key={`cluster-${key}`} position={[lat, lng]} icon={DotIcon}>
              <Popup minWidth={220} closeOnEscapeKey={true}>
                <div className="font-bold text-center mb-2">{snapsInCluster.length} snaps here</div>
                <ul className="max-h-40 overflow-y-auto text-xs">
                  {snapsInCluster.map(snap => (
                    <li key={snap.id} className="mb-2 border-b border-zinc-200 pb-1 last:border-b-0">
                      <div className="font-semibold">{snap.utilizatori?.name}</div>
                      <div className="italic text-zinc-500">{snap.description}</div>
                      <button
                        className="mt-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        onClick={() => onSnapDetails(snap)}
                      >
                        View details
                      </button>
                    </li>
                  ))}
                </ul>
              </Popup>
            </Marker>
          );
        }
      })}
    </MapContainer>
  );
};

export default ClusteredMap;
