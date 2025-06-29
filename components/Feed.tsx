import { useEffect, useState, useCallback, FC } from "react";
import { createClient } from "@/lib/supabase/client";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const Feed: FC = () => {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = await createClient();
      const { data: snapsData, error: snapsError } = await supabase
        .from("snaps")
        .select("*")
        .order("created_at", { ascending: false });
      if (snapsError) throw snapsError;
      const { data: usersData, error: usersError } = await supabase
        .from("utilizatori")
        .select("id, name, avatar_url");
      if (usersError) throw usersError;
      const usersMap = (usersData || []).reduce((acc: any, user: any) => {
        acc[user.id] = user;
        return acc;
      }, {});
      const snapsWithUser = (snapsData || []).map((snap: any) => ({
        ...snap,
        utilizatori: usersMap[snap.user_id] || null,
      }));
      setSnaps(snapsWithUser);
    } catch (err: any) {
      setError(err.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnaps();
  }, [fetchSnaps]);

  if (loading) return <div className="p-8 text-center text-zinc-400">Loading feed...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      {snaps.length === 0 && <div className="text-center text-zinc-400">No snaps yet.</div>}
      {snaps.map((snap) => (
        <div key={snap.id} className="bg-zinc-900 rounded-xl shadow p-4 border border-zinc-700 flex flex-col items-center">
          <img
            src={`${SUPABASE_URL}/storage/v1/object/public/images/${snap.image_url}`}
            alt="Snap"
            className="rounded-lg border border-zinc-700 mb-2 w-full max-w-xs max-h-64 object-cover bg-zinc-800"
            loading="lazy"
          />
          {snap.utilizatori?.name && (
            <div className="text-sm font-semibold text-blue-400 mb-1">{snap.utilizatori.name}</div>
          )}
          <div className="text-zinc-100 text-base text-center break-words w-full px-2 leading-tight mb-1 mt-1">
            {snap.description.length > 120 ? `${snap.description.substring(0, 120)}...` : snap.description}
          </div>
          <div className="text-zinc-400 text-xs mt-1 font-mono">
            {new Date(snap.created_at).toLocaleDateString('en-US', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit'
            })}
            <span className="ml-2">{new Date(snap.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Feed;
