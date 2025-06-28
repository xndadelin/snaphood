"use client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/utils/getUser";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function LocateUser() {
  const map = useMap();
  useEffect(() => {
    interface LocationEvent {
      latlng: L.LatLng;
      [key: string]: any;
    }

    function onLocationFound(e: LocationEvent): void {
      console.log("locationfound", e);
      L.marker(e.latlng).addTo(map)
        .bindPopup("You are here!").openPopup();
    }
    interface LocationErrorEvent {
      message: string;
      code: number;
      [key: string]: any;
    }

    function onLocationError(e: LocationErrorEvent): void {
      console.log("locationerror", e);
      alert("Location access denied.");
    }

    map.on("locationfound", onLocationFound);
    map.on("locationerror", onLocationError);
    map.locate({ setView: true, maxZoom: 16 });

    return () => {
      map.off("locationfound", onLocationFound);
      map.off("locationerror", onLocationError);
    };
  }, [map]);
  return null;
}

function dataURLtoBlob(dataurl: string) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

const putImageInStorage = async (image: string ) => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user || !user.id) {
    throw new Error("User not found. Cannot upload image.");
  }
  const imageBlob = dataURLtoBlob(image);
  const { data, error } = await supabase.storage.from("images")
    .upload(`user-${user.id}/${Date.now()}.png`, imageBlob, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error("Failed to upload image");
  } 

  return data.path;
}

const onHandleSubmit = async (photo: string, description: string, lat: number | null, lng: number | null) => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user || !user.id) {
    throw new Error("User not found. Cannot submit post.");
  }

  const imagePath = await putImageInStorage(photo);

  const { data, error } = await supabase.from("snaps").insert({
    user_id: user.id,
    image_url: imagePath,
    description,
    lat,
    lng,
    created_at: new Date().toISOString(),
  });

  console.log(data, error);
}

const MapComponent = () => {
  const [showCamera, setShowCamera] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [snaps, setSnaps] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchSnaps = async () => {
      const supabase = await createClient();
      const { data, error } = await supabase.from("snaps").select("*");
      if (error) {
        console.error("[SNAPS] Eroare la fetch:", error);
      }
      if (data) {
        console.log("[SNAPS] Fetched:", data);
        setSnaps(data);
      } else {
        console.warn("[SNAPS] Nu s-au gasit snaps in DB!");
      }
    };
    fetchSnaps();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        (err) => {
          console.warn("Could not get location", err);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    if (showCamera && videoRef.current) {
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? "user" : "environment" }
      })
        .then((stream) => {
          (videoRef.current as any).srcObject = stream;
        });
    }
    if (!showCamera && videoRef.current && (videoRef.current as any).srcObject) {
      const tracks = (videoRef.current as any).srcObject.getTracks();
      tracks.forEach((track: any) => track.stop());
    }
  }, [showCamera, useFrontCamera]);

  const handleCapture = () => {
    const video = videoRef.current as any;
    const canvas = canvasRef.current as any;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (useFrontCamera) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      const dataUrl = canvas.toDataURL("image/png");
      // TEST: log the dataUrl length and a preview
      console.log("[TEST] Captured photo dataUrl length:", dataUrl.length);
      console.log("[TEST] Captured photo dataUrl (first 100 chars):", dataUrl.slice(0, 100));
      setPhoto(dataUrl);

      if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach((track: any) => track.stop());
        video.srcObject = null;
      }
      setShowCamera(false);
    }
  };

  return (
    <div>
      <div className="fixed inset-0 w-full h-full z-0">
        <div style={{ height: "100vh", width: "100vw" }}>
          <MapContainer
            scrollWheelZoom={true}
            style={{ height: "100vh", width: "100vw" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocateUser />
            {snaps.map(snap => {
              const lat = typeof snap.lat === 'string' ? parseFloat(snap.lat) : snap.lat;
              const lng = typeof snap.lng === 'string' ? parseFloat(snap.lng) : snap.lng;
              if (!lat || !lng) return null;
              return (
                <>
                  <Marker key={snap.id} position={[lat, lng]} />
                  <div
                    key={snap.id + '-overlay'}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${(lng - snaps[0].lng) * 100}px)`, // crude projection for demo
                      top: `calc(50% - ${(lat - snaps[0].lat) * 100}px)`
                    }}
                    className="z-[1000] pointer-events-auto"
                  >
                    <div className="flex flex-col items-center bg-black/80 rounded-xl p-3 border border-zinc-700 shadow-xl">
                      <img
                        src={`${SUPABASE_URL}/storage/v1/object/public/images/${snap.image_url}`}
                        alt="Snap image"
                        className="max-h-[30vh] max-w-xs object-contain rounded mb-2"
                        style={{background: '#222'}}
                      />
                      <div className="text-white text-sm text-center break-words max-w-xs">{snap.description}</div>
                    </div>
                  </div>
                </>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Remove always-visible gallery, only show on map pins */}

      {showCamera && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <video
            ref={videoRef}
            autoPlay
            className={`rounded-lg shadow-lg w-full max-w-xs mb-4 ${useFrontCamera ? 'scale-x-[-1]' : ''}`}
            style={useFrontCamera ? { transform: 'scaleX(-1)' } : {}}
          />
          <div className="flex gap-2 mb-4">
            <button
              className="min-w-[100px] px-6 py-2 bg-green-600 text-white rounded-full font-bold shadow hover:bg-green-700"
              onClick={handleCapture}
            >
              Capture
            </button>
            <button
              className="min-w-[100px] px-6 py-2 bg-blue-600 text-white rounded-full font-bold shadow hover:bg-blue-700"
              onClick={() => setUseFrontCamera((v) => !v)}
            >
              Invert
            </button>
            <button
              className="min-w-[100px] px-6 py-2 bg-gray-700 text-white rounded-full font-bold shadow hover:bg-gray-800"
              onClick={() => setShowCamera(false)}
            >
              Cancel
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {photo && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl shadow-2xl p-6 flex flex-col items-center max-w-xs w-full border border-zinc-700">
            <img src={photo} alt="Captured" className="max-w-full max-h-[70vh] object-contain rounded mb-4 border-4 border-zinc-800" />
            <textarea
              className="w-full mb-4 p-2 rounded bg-zinc-800 text-white border border-zinc-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add a description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <div className="flex gap-4">
              <button
                className="min-w-[100px] px-6 py-2 bg-green-600 text-white rounded-full font-bold shadow hover:bg-green-700"
                onClick={async () => {
                  if (photo && description && lat && lng) {
                    await onHandleSubmit(photo, description, lat, lng);
                    setPhoto(null);
                    setDescription("");
                  }
                }}
                disabled={!photo || !description || !lat || !lng}
              >
                Confirm
              </button>
              <button
                className="min-w-[100px] px-6 py-2 bg-red-600 text-white rounded-full font-bold shadow hover:bg-red-700"
                onClick={() => {
                  setPhoto(null);
                  setTimeout(() => setShowCamera(true), 100);
                }}
              >
                Retake
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-8 right-8 z-50 flex items-center gap-2 bg-black/90 text-white px-7 py-4 rounded-full shadow-2xl transition-all duration-200 pointer-events-auto border-2 border-white/60"
        style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.04em', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.18)' }}
        onClick={() => setShowCamera(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 drop-shadow">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Post
      </button>
    </div>
  );
};

export default MapComponent;