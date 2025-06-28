"use client";
import dynamic from "next/dynamic";

import { useEffect } from "react";

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });

export default function MapPage() {

  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log(pos)
          const { latitude, longitude } = pos.coords;
          console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
        },
        (err) => {
          console.error("Geo error:", err);
        }
      );
    }
  }, []);

  return <MapComponent />;
}