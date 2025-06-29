"use client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/utils/getUser";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Snap {
  id: string;
  user_id: string;
  image_url: string;
  description: string;
  lat: number;
  lng: number;
  created_at: string;
  reactions?: { [emoji: string]: string[] };
  utilizatori?: {
    name?: string;
    avatar_url?: string;
  };
}

interface LocationEvent {
  latlng: L.LatLng;
  [key: string]: any;
}

interface LocationErrorEvent {
  message: string;
  code: number;
  [key: string]: any;
}

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

function LocateUser({ setUserLocation }: { setUserLocation: (latlng: L.LatLng) => void }) {
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
}

function dataURLtoBlob(dataurl: string): Blob {
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

const putImageInStorage = async (image: string): Promise<string> => {
  const supabase = await createClient();
  const user = await getUser();

  if (!user || !user.id) {
    throw new Error("User not found. Cannot upload image.");
  }

  const imageBlob = dataURLtoBlob(image);
  const fileName = `user-${user.id}/${Date.now()}.png`;

  const { data, error } = await supabase.storage
    .from("images")
    .upload(fileName, imageBlob, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  return data.path;
};

const onHandleSubmit = async (
  photo: string,
  description: string,
  lat: number | null,
  lng: number | null
): Promise<void> => {
  if (!lat || !lng) {
    throw new Error("Location is required to post a snap.");
  }

  const supabase = await createClient();
  const user = await getUser();

  if (!user || !user.id) {
    throw new Error("User not found. Cannot submit post.");
  }

  try {
    const imagePath = await putImageInStorage(photo);

    const { data, error } = await supabase.from("snaps").insert({
      user_id: user.id,
      image_url: imagePath,
      description: description.trim(),
      lat,
      lng,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Database insert error:", error);
      throw new Error(`Failed to save snap: ${error.message}`);
    }

  } catch (error) {
    console.error("Submit error:", error);
    throw error;
  }
};

const MapComponent = () => {
  const [showCamera, setShowCamera] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [snapAddresses, setSnapAddresses] = useState<{ [snapId: string]: string | null }>({});
  
  const [comments, setComments] = useState<{ [snapId: string]: Array<{ id: string; user_id: string; text: string; created_at: string; user_name?: string }> }>({});
  const [commentInputs, setCommentInputs] = useState<{ [snapId: string]: string }>({});
  const [commentLoading, setCommentLoading] = useState<{ [snapId: string]: boolean }>({});

  const fetchComments = useCallback(async (snapId: string) => {
    try {
      const supabase = await createClient();

      const { data: commentsData, error: commentsError } = await supabase
        .from("comentarii")
        .select("id, user_id, text, created_at")
        .eq("snap_id", snapId)
        .order("created_at", { ascending: true });
      
      if (commentsError || !commentsData) return;
      
      const userIds = Array.from(new Set(commentsData.map((c: any) => c.user_id)));
      let usersMap: { [id: string]: { name?: string } } = {};
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from("utilizatori")
          .select("id, name")
          .in("id", userIds);
        
        if (!usersError && usersData) {
          usersMap = usersData.reduce((acc: any, user: any) => {
            acc[user.id] = user;
            return acc;
          }, {});
        }
      }
      setComments(prev => ({
        ...prev,
        [snapId]: commentsData.map((c: any) => ({ ...c, user_name: usersMap[c.user_id]?.name }))
      }));
    } catch {}
  }, []);

  useEffect(() => {
    snaps.forEach(snap => {
      fetchComments(snap.id);
    });
  }, [snaps, fetchComments]);


  const handleCommentInput = (snapId: string, value: string) => {
    setCommentInputs(prev => ({ ...prev, [snapId]: value }));
  };

  const handleCommentSubmit = async (snapId: string) => {
    const text = (commentInputs[snapId] || '').trim();
    if (!text) return;
    setCommentLoading(prev => ({ ...prev, [snapId]: true }));
    try {
      const supabase = await createClient();
      const user = await getUser();
      if (!user || !user.id) throw new Error('Not logged in');
      const { error } = await supabase.from("comentarii").insert({
        snap_id: snapId,
        user_id: user.id,
        text
      });
      if (!error) {
        setCommentInputs(prev => ({ ...prev, [snapId]: '' }));
        fetchComments(snapId);
      }
    } finally {
      setCommentLoading(prev => ({ ...prev, [snapId]: false }));
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<L.LatLng | null>(null);
  useEffect(() => {
    if (userLocation) {
      getLocationName(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

  const markerRefs = useRef<(L.Marker | null)[]>([]);
  // const [reactionState, setReactionState] = useState<{
  //   [snapId: string]: {
  //     userReacted: string | null;
  //     userId: string | null;
  //   }
  // }>({});
  // const emojis = ["👍", "😂", "😍", "🔥", "😮", "😢"];

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);


  // useEffect(() => {
  //   (async () => {
  //     const user = await getUser();
  //     if (!snaps.length) return;
  //     setReactionState(prev => {
  //       const next = { ...prev };
  //       for (const snap of snaps) {
  //         let userReacted: string | null = null;
  //         if (snap.reactions && user && user.id) {
  //           for (const emoji of emojis) {
  //             if (Array.isArray(snap.reactions[emoji]) && snap.reactions[emoji].includes(user.id)) {
  //               userReacted = emoji;
  //               break;
  //             }
  //           }
  //         }
  //         next[snap.id] = {
  //           userReacted,
  //           userId: user?.id || null,
  //         };
  //       }
  //       Object.keys(next).forEach(id => {
  //         if (!snaps.find(s => s.id === id)) delete next[id];
  //       });
  //       return next;
  //     });
  //   })();
  // }, [snaps]);

  // const handleReaction = async (snapId: string, emoji: string) => {
  //   const user = await getUser();
  //   if (!user || !user.id) return;
  //   const snap = snaps.find(s => s.id === snapId);
  //   if (!snap) return;
  //   const currentReactions: { [emoji: string]: string[] } = { ...Object.fromEntries(emojis.map(e => [e, []])), ...(snap.reactions || {}) };
  //   const userReacted = reactionState[snapId]?.userReacted;
  //   let newReactions = { ...currentReactions };
  //   
  //   for (const e of emojis) {
  //     newReactions[e] = (newReactions[e] || []).filter((uid: string) => uid !== user.id);
  //   }
  //   let newUserReacted = null;
  //   if (userReacted !== emoji) {
  //     newReactions[emoji] = [...(newReactions[emoji] || []), user.id];
  //     newUserReacted = emoji;
  //   }
  //   setReactionState(prev => ({
  //     ...prev,
  //     [snapId]: { userReacted: newUserReacted, userId: user.id },
  //   }));
  //   const supabase = await createClient();
  //   await supabase.from("snaps").update({ reactions: newReactions }).eq("id", snapId);
  //   fetchSnaps();
  // };

  const fetchSnaps = useCallback(async () => {
    try {
      const supabase = await createClient();
      const { data: snapsData, error: snapsError } = await supabase
        .from("snaps")
        .select("*")
        .order("created_at", { ascending: false });
      if (snapsError) {
        console.error("Error fetching snaps:", snapsError);
        setError("Failed to load snaps");
        return;
      }
      const { data: usersData, error: usersError } = await supabase
        .from("utilizatori")
        .select("id, name, avatar_url");
      if (usersError) {
        console.error("Error fetching users:", usersError);
        setError("Failed to load users");
        return;
      }
      const usersMap = (usersData || []).reduce((acc: any, user: any) => {
        acc[user.id] = user;
        return acc;
      }, {});
      const snapsWithUser = (snapsData || []).map((snap: any) => ({
        ...snap,
        utilizatori: usersMap[snap.user_id] || null,
      }));
      setSnaps(snapsWithUser);
    } catch (err) {
      console.error("Fetch snaps error:", err);
      setError("Failed to load snaps");
    }
  }, []);

  useEffect(() => {
    fetchSnaps();
    let supabaseRealtime: any = null;
    (async () => {
      const supabase = await createClient();
      supabaseRealtime = supabase.channel('snaps-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'snaps' }, (payload: any) => {
          fetchSnaps();
        })
        .subscribe();
    })();
    return () => {
      if (supabaseRealtime) {
        supabaseRealtime.unsubscribe();
      }
    };
  }, [fetchSnaps]);

  useEffect(() => {
    async function fetchAddresses() {
      const newAddresses: { [snapId: string]: string | null } = {};
      await Promise.all(snaps.map(async (snap) => {
        const snapLat = typeof snap.lat === 'string' ? parseFloat(snap.lat) : snap.lat;
        const snapLng = typeof snap.lng === 'string' ? parseFloat(snap.lng) : snap.lng;
        if (!snapLat || !snapLng || isNaN(snapLat) || isNaN(snapLng)) {
          newAddresses[snap.id] = null;
          return;
        }
        try {
          const address = await getLocationName(snapLat, snapLng);
          newAddresses[snap.id] = address;
        } catch {
          newAddresses[snap.id] = "Address unavailable";
        }
      }));
      setSnapAddresses(newAddresses);
    }
    if (snaps.length > 0)  {
      fetchAddresses();
    } else {
      setSnapAddresses({});
    }
  }, [snaps]);


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        (err) => {
          console.warn("Could not get location:", err);
          setError("Location access denied. Please enable location services.");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
    }
  }, []);

  useEffect(() => {
    const setupCamera = async () => {
      if (showCamera && videoRef.current) {
        try {
          cleanupStream();

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: useFrontCamera ? "user" : "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          });

          streamRef.current = stream;
          videoRef.current.srcObject = stream;
        } catch (err) {
          console.error("Camera error:", err);
          setError("Failed to access camera. Please check camera permissions.");
          setShowCamera(false);
        }
      } else if (!showCamera) {
        cleanupStream();
      }
    };

    setupCamera();
  }, [showCamera, useFrontCamera, cleanupStream]);

  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setError("Camera not ready. Please try again.");
      return;
    }

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setError("Failed to get canvas context.");
        return;
      }

      if (useFrontCamera) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      const dataUrl = canvas.toDataURL("image/png", 0.8);
      setPhoto(dataUrl);
      setShowCamera(false);
      cleanupStream();
    } catch (err) {
      console.error("Capture error:", err);
      setError("Failed to capture photo. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!photo || !description.trim() || !lat || !lng) {
      setError("Please provide a photo, description, and location.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onHandleSubmit(photo, description, lat, lng);
      setPhoto(null);
      setDescription("");
      setError(null);

      await fetchSnaps();
    } catch (err) {
      console.error("Submit error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit snap");
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapCenter: [number, number] = [37.7749, -122.4194];
  const mapZoom = 12;

  return (
    <div>
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-600 text-white p-3 rounded-lg shadow-lg">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-0 w-full h-full z-0">
        <div style={{ height: "100vh", width: "100vw" }}>
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
            {snaps.map((snap, idx) => {
              const snapLat = typeof snap.lat === 'string' ? parseFloat(snap.lat) : snap.lat;
              const snapLng = typeof snap.lng === 'string' ? parseFloat(snap.lng) : snap.lng;
              if (!snapLat || !snapLng || isNaN(snapLat) || isNaN(snapLng)) {
                console.warn(`Invalid coordinates for snap ${snap.id}:`, { lat: snap.lat, lng: snap.lng });
                return null;
              }
              // const snapReactions = snap.reactions || Object.fromEntries(emojis.map(e => [e, []]));
              // const userReacted = reactionState[snap.id]?.userReacted || null;
              return (
                <Marker
                  key={`marker-${snap.id}`}
                  position={[snapLat, snapLng]}
                  icon={DotIcon}
                  ref={(el) => {
                    markerRefs.current[idx] = el;
                  }}
                >
                  <Popup maxWidth={400} maxHeight={500} closeOnEscapeKey={true}>
                    <div
                      className="flex flex-col items-center p-2 bg-white rounded-lg shadow-lg"
                      style={{ overflow: 'hidden', width: 340, boxSizing: 'border-box' }}
                    >
                      <img  
                        src={`${SUPABASE_URL}/storage/v1/object/public/images/${snap.image_url}`}
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
                      {/* <div className="flex flex-row gap-2 justify-center items-center w-full mb-2 mt-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            className={`flex flex-col items-center px-2 py-1 rounded-lg transition-all text-xl font-bold border border-transparent hover:bg-zinc-100 active:scale-95 ${userReacted === emoji ? 'bg-yellow-100 border-yellow-400' : ''}`}
                            onClick={() => handleReaction(snap.id, emoji)}
                            title={userReacted ? (userReacted === emoji ? 'Remove reaction' : 'Change your reaction') : 'React'}
                          >
                            <span>{emoji}</span>
                            <span className="text-xs font-semibold text-zinc-600 mt-0.5">{(snapReactions[emoji] || []).length}</span>
                          </button>
                        ))}
                      </div> */}
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
                        {snapAddresses[snap.id] === undefined ? 'Searching address...' : (snapAddresses[snap.id] || 'Address unavailable')}
                      </div>
                      <div className="w-full mt-2">
                        <div className="font-semibold text-sm text-gray-800 mb-1">Comments</div>
                        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto bg-zinc-900 rounded-lg border border-gray-700 p-2">
                          {Array.isArray(comments[snap.id]) && comments[snap.id].length > 0 ? (
                            comments[snap.id].map((c) => (
                              <div key={c.id} className="text-xs text-zinc-100 flex flex-row items-center gap-2">
                                <span className="font-semibold text-blue-400">{c.user_name || c.user_id?.slice(0, 6) || 'user'}:</span>
                                <span className="text-zinc-100">{c.text}</span>
                                <span className="text-gray-400 ml-auto">{new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-gray-400 italic text-center">No comments yet.</div>
                          )}
                        </div>
                        <div className="flex mt-2 gap-2">
                        <input
                          type="text"
                          className="flex-1 px-2 py-1 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder-gray-400"
                          placeholder="Add a comment..."
                          value={commentInputs[snap.id] || ''}
                          onChange={e => handleCommentInput(snap.id, e.target.value)}
                          disabled={commentLoading[snap.id]}
                          maxLength={300}
                        />
                          <button
                            className="px-3 py-1 bg-blue-600 text-white rounded font-semibold text-sm disabled:opacity-60"
                            disabled={commentLoading[snap.id] || !(commentInputs[snap.id] && commentInputs[snap.id].trim())}
                            onClick={() => handleCommentSubmit(snap.id)}
                          >
                            {commentLoading[snap.id] ? '...' : 'Post'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="rounded-lg shadow-lg w-full max-w-sm mb-4"
            style={useFrontCamera ? { transform: 'scaleX(-1)' } : {}}
          />
          <div className="flex gap-3 mb-4 flex-wrap justify-center">
            <button
              className="min-w-[80px] px-4 py-2 bg-green-600 text-white rounded-full font-semibold shadow hover:bg-green-700 transition-colors"
              onClick={handleCapture}
            >
              Capture
            </button>
            <button
              className="min-w-[80px] px-4 py-2 bg-blue-600 text-white rounded-full font-semibold shadow hover:bg-blue-700 transition-colors"
              onClick={() => setUseFrontCamera((v) => !v)}
            >
              Flip
            </button>
            <button
              className="min-w-[80px] px-4 py-2 bg-gray-600 text-white rounded-full font-semibold shadow hover:bg-gray-700 transition-colors"
              onClick={() => {
                setShowCamera(false);
                cleanupStream();
              }}
            >
              Cancel
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {photo && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl shadow-2xl p-6 flex flex-col items-center max-w-sm w-full border border-zinc-700">
            <img
              src={photo}
              alt="Captured"
              className="max-w-full max-h-[50vh] object-contain rounded mb-4 border-2 border-zinc-700"
            />
            <textarea
              className="w-full mb-4 p-3 rounded-lg bg-zinc-800 text-white border border-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Add a description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
            />
            <div className="text-xs text-zinc-400 mb-4 self-end">
              {description.length}/500
            </div>
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold shadow hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={!photo || !description.trim() || !lat || !lng || isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Post"}
              </button>
              <button
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold shadow hover:bg-red-700 transition-colors"
                onClick={() => {
                  setPhoto(null);
                  setDescription("");
                  setTimeout(() => setShowCamera(true), 100);
                }}
                disabled={isSubmitting}
              >
                Retake
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-6 right-6 z-40 px-6 py-3 bg-zinc-900 text-white rounded-lg font-semibold shadow-lg hover:bg-zinc-800 transition-colors border border-zinc-700"
        onClick={() => {
          if (!lat || !lng) {
            setError("Location is not available. Please enable location services.");
            return;
          }
          setShowCamera(true);
        }}
        disabled={!lat || !lng}
        title="Post a photo"
      >
        Post
      </button>
    </div>
  );
};

async function getLocationName(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'snaphood/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.display_name || null;
}

export default MapComponent;