import { FC } from "react";
import { Marker, Popup } from "react-leaflet";
import CommentsSection from "./CommentsSection";
import L from "leaflet";

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

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  user_name?: string;
}

interface SnapMarkerProps {
  snap: Snap;
  idx: number;
  markerRef: (el: L.Marker | null) => void;
  icon: L.DivIcon;
  supabaseUrl: string;
  address: string | null | undefined;
  comments: Comment[];
  commentInput: string;
  commentLoading: boolean;
  onCommentInput: (value: string) => void;
  onCommentSubmit: () => void;
}

const SnapMarker: FC<SnapMarkerProps> = ({
  snap,
  idx,
  markerRef,
  icon,
  supabaseUrl,
  address,
  comments,
  commentInput,
  commentLoading,
  onCommentInput,
  onCommentSubmit,
}) => {
  const snapLat = typeof snap.lat === 'string' ? parseFloat(snap.lat as any) : snap.lat;
  const snapLng = typeof snap.lng === 'string' ? parseFloat(snap.lng as any) : snap.lng;
  if (!snapLat || !snapLng || isNaN(snapLat) || isNaN(snapLng)) return null;
  return (
    <Marker
      key={`marker-${snap.id}`}
      position={[snapLat, snapLng]}
      icon={icon}
      ref={markerRef}
    >
      <Popup maxWidth={400} maxHeight={500} closeOnEscapeKey={true}>
        <div
          className="flex flex-col items-center p-2 bg-white rounded-lg shadow-lg"
          style={{ overflow: 'hidden', width: 340, boxSizing: 'border-box' }}
        >
          <img
            src={`${supabaseUrl}/storage/v1/object/public/images/${snap.image_url}`}
            alt="Snap"
            className="rounded-lg border border-zinc-300 mb-2"
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 300,
              maxHeight: 180,
              background: '#f0f0f0',
              objectFit: 'cover',
            }}
            loading="lazy"
          />
          {snap.utilizatori?.name && (
            <div className="text-sm font-semibold text-blue-700 mb-1">
              {snap.utilizatori.name}
            </div>
          )}
          <div className="text-gray-800 text-base text-center break-words w-full px-2 leading-tight mb-1 mt-1">
            {snap.description.length > 60 ? `${snap.description.substring(0, 60)}...` : snap.description}
          </div>
          <div className="text-gray-500 text-sm mt-1 font-mono">
            {new Date(snap.created_at).toLocaleDateString('en-US', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit'
            })}
            <span className="ml-2">{new Date(snap.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <div className="text-gray-700 text-xs mt-1 font-mono text-center min-h-[18px]">
            {address === undefined ? 'Searching address...' : (address || 'Address unavailable')}
          </div>
          <CommentsSection
            comments={comments}
            inputValue={commentInput}
            loading={commentLoading}
            onInput={onCommentInput}
            onSubmit={onCommentSubmit}
          />
        </div>
      </Popup>
    </Marker>
  );
};

export default SnapMarker;