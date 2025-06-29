import { FC } from "react";

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

interface SnapDetailsModalProps {
  snap: Snap;   
  supabaseUrl: string;
  address?: string | null;
  comments: Comment[];
  commentInput: string;
  commentLoading: boolean;
  onCommentInput: (value: string) => void;
  onCommentSubmit: () => void;
  onClose: () => void;
}

const SnapDetailsModal: FC<SnapDetailsModalProps> = ({
  snap,
  supabaseUrl,
  address,
  comments,
  commentInput,
  commentLoading,
  onCommentInput,
  onCommentSubmit,
  onClose,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-2xl p-4 max-w-md w-full relative">
      <button
        className="absolute top-2 right-2 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 hover:bg-red-100 border border-zinc-200 shadow transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 z-10"
        onClick={onClose}
        aria-label="Close"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-gray-600 hover:text-red-500 transition-colors duration-150">
          <path fillRule="evenodd" d="M10 8.586l4.95-4.95a1 1 0 111.414 1.414L11.414 10l4.95 4.95a1 1 0 01-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 01-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 115.05 3.636L10 8.586z" clipRule="evenodd" />
        </svg>
      </button>
      <img
        src={`${supabaseUrl}/storage/v1/object/public/images/${snap.image_url}`}
        alt="Snap"
        className="rounded-lg border border-zinc-300 mb-2 w-full max-h-60 object-cover"
        loading="lazy"
      />
      {snap.utilizatori?.name && (
        <div className="text-sm font-semibold text-blue-700 mb-1">
          {snap.utilizatori.name}
        </div>
      )}
      <div className="text-gray-800 text-base text-center break-words w-full px-2 leading-tight mb-1 mt-1">
        {snap.description}
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
      <div className="mt-4">
        <div className="font-semibold mb-2">Comments</div>
        <div className="max-h-32 overflow-y-auto mb-2">
          {comments.length === 0 && <div className="text-xs text-gray-400">No comments yet.</div>}
          {comments.map(comment => (
            <div key={comment.id} className="mb-1 border-b border-zinc-200 pb-1 last:border-b-0">
              <span className="font-semibold text-xs text-blue-700">{comment.user_name || 'User'}:</span> {comment.text}
              <div className="text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-zinc-300 rounded px-2 py-1 text-xs bg-zinc-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add a comment..."
            value={commentInput}
            onChange={e => onCommentInput(e.target.value)}
            disabled={commentLoading}
            maxLength={200}
          />
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
            onClick={onCommentSubmit}
            disabled={commentLoading || !commentInput.trim()}
          >
            {commentLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SnapDetailsModal;
