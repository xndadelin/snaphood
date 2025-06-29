"use client";
import SnapDetailsModal from "./SnapDetailsModal";
import CameraModal from "./CameraModal";
import ClusteredMap from "./ClusteredMap";
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
  const [selectedSnap, setSelectedSnap] = useState<Snap | null>(null);
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
          <ClusteredMap
            snaps={snaps}
            snapAddresses={snapAddresses}
            userLocation={userLocation}
            comments={comments}
            commentInputs={commentInputs}
            commentLoading={commentLoading}
            onCommentInput={handleCommentInput}
            onCommentSubmit={handleCommentSubmit}
            setUserLocation={setUserLocation}
            onSnapDetails={setSelectedSnap}
          />
        </div>
      </div>
      {selectedSnap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <SnapDetailsModal
            snap={selectedSnap}
            supabaseUrl={SUPABASE_URL}
            address={snapAddresses[selectedSnap.id]}
            comments={comments[selectedSnap.id] || []}
            commentInput={commentInputs[selectedSnap.id] || ''}
            commentLoading={commentLoading[selectedSnap.id]}
            onCommentInput={val => handleCommentInput(selectedSnap.id, val)}
            onCommentSubmit={() => handleCommentSubmit(selectedSnap.id)}
            onClose={() => setSelectedSnap(null)}
          />
        </div>
      )}

      <CameraModal
        show={showCamera}
        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
        canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        useFrontCamera={useFrontCamera}
        onCapture={handleCapture}
        onFlip={() => setUseFrontCamera((v) => !v)}
        onCancel={() => {
          setShowCamera(false);
          cleanupStream();
        }}
      />

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