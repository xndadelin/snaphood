import { FC, RefObject } from "react";

interface CameraModalProps {
  show: boolean;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  useFrontCamera: boolean;
  onCapture: () => void;
  onFlip: () => void;
  onCancel: () => void;
}

const CameraModal: FC<CameraModalProps> = ({
  show,
  videoRef,
  canvasRef,
  useFrontCamera,
  onCapture,
  onFlip,
  onCancel,
}) => {
  if (!show) return null;
  return (
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
          onClick={onCapture}
        >
          Capture
        </button>
        <button
          className="min-w-[80px] px-4 py-2 bg-blue-600 text-white rounded-full font-semibold shadow hover:bg-blue-700 transition-colors"
          onClick={onFlip}
        >
          Flip
        </button>
        <button
          className="min-w-[80px] px-4 py-2 bg-gray-600 text-white rounded-full font-semibold shadow hover:bg-gray-700 transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraModal;
