import { FC } from "react";

interface Comment {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  user_name?: string;
}

interface CommentsSectionProps {
  comments: Comment[];
  inputValue: string;
  loading: boolean;
  onInput: (value: string) => void;
  onSubmit: () => void;
}

const CommentsSection: FC<CommentsSectionProps> = ({
  comments,
  inputValue,
  loading,
  onInput,
  onSubmit,
}) => (
  <div className="w-full mt-2">
    <div className="font-semibold text-sm text-gray-800 mb-1">Comments</div>
    <div className="flex flex-col gap-2 max-h-32 overflow-y-auto bg-zinc-900 rounded-lg border border-gray-700 p-2">
      {Array.isArray(comments) && comments.length > 0 ? (
        comments.map((c) => (
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
        value={inputValue}
        onChange={e => onInput(e.target.value)}
        disabled={loading}
        maxLength={300}
      />
      <button
        className="px-3 py-1 bg-blue-600 text-white rounded font-semibold text-sm disabled:opacity-60"
        disabled={loading || !inputValue.trim()}
        onClick={onSubmit}
      >
        {loading ? '...' : 'Post'}
      </button>
    </div>
  </div>
);

export default CommentsSection;
