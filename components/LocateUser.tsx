import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface LocationEvent {
  latlng: L.LatLng;
  [key: string]: any;
}

interface LocationErrorEvent {
  message: string;
  code: number;
  [key: string]: any;
}

const LocateUser = ({ setUserLocation }: { setUserLocation: (latlng: L.LatLng) => void }) => {
  const map = useMap();

  useEffect(() => {
    function onLocationFound(e: LocationEvent): void {
      setUserLocation(e.latlng);
    }

    function onLocationError(e: LocationErrorEvent): void {
      console.warn("Location error:", e);
      if (e.code === 1) {
        alert("Location access denied. Please enable location services to see your position on the map.");
      } else {
        alert("Unable to retrieve your location. Please check your location settings.");
      }
    }

    map.on("locationfound", onLocationFound);
    map.on("locationerror", onLocationError);
    map.locate({ setView: false, watch: true, maxZoom: 16 });

    return () => {
      map.off("locationfound", onLocationFound);
      map.off("locationerror", onLocationError);
    };
  }, [map, setUserLocation]);

  return null;
};

export default LocateUser;
