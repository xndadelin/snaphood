"use client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import React, { useEffect } from "react";

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

export default function MapComponent() {
  const [showCamera, setShowCamera] = React.useState(false);
  const [useFrontCamera, setUseFrontCamera] = React.useState(false);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [photo, setPhoto] = React.useState<string | null>(null);

  React.useEffect(() => {
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
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL("image/png"));

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
        <div style={{ height: "100vh", width: "100vw", pointerEvents: "none" }}>
          <MapContainer
            center={[37.7749, -122.4194]}
            zoom={13}
            scrollWheelZoom={true}
            style={{ height: "100vh", width: "100vw" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocateUser />
          </MapContainer>
        </div>
      </div>

      {/* Camera Modal */}
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
              className="px-6 py-2 bg-green-600 text-white rounded-full font-bold shadow hover:bg-green-700"
              onClick={handleCapture}
            >
              Capture
            </button>
            <button
              className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold shadow hover:bg-blue-700"
              onClick={() => setUseFrontCamera((v) => !v)}
            >
              Invert
            </button>
            <button
              className="px-4 py-2 bg-gray-700 text-white rounded-full text-sm"
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
            <img src={photo} alt="Captured" className="w-64 h-64 object-cover rounded mb-4 border-4 border-zinc-800" />
            <div className="flex gap-4">
              <button
                className="px-6 py-2 bg-green-600 text-white rounded-full font-bold shadow hover:bg-green-700"
                onClick={() => setPhoto(null)}
              >
                Confirm
              </button>
              <button
                className="px-6 py-2 bg-red-600 text-white rounded-full font-bold shadow hover:bg-red-700"
                onClick={() => setPhoto(null)}
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
}