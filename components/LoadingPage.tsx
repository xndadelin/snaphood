export default function LoadingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white z-50 fixed inset-0">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent mb-4"></div>
      <span className="text-black text-lg font-medium">Loading...</span>
    </div>
  );
}
