import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from './ui/Button';

/**
 * Draw a signature with mouse, pen or finger. Each finished stroke exports the
 * canvas as a transparent PNG, which is uploaded exactly like a chosen image file.
 */
export function SignaturePad({ onChange }: { onChange: (file: File | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // Size the backing store to the element (and screen density) so strokes stay crisp.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#1e293b';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const exportImage = () => {
    canvasRef.current!.toBlob((blob) => {
      if (blob) onChange(new File([blob], 'signature.png', { type: 'image/png' }));
    }, 'image/png');
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          className="block h-36 w-full cursor-crosshair touch-none"
          aria-label="Signature drawing area. Draw your signature with a mouse, pen or finger."
          role="img"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
            const ctx = e.currentTarget.getContext('2d')!;
            ctx.beginPath();
            ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const ctx = e.currentTarget.getContext('2d')!;
            const p = point(e);
            const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={() => {
            if (!drawing.current) return;
            drawing.current = false;
            last.current = null;
            setIsEmpty(false);
            exportImage();
          }}
          onPointerCancel={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-7 border-b border-slate-200" aria-hidden="true" />
        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400" aria-hidden="true">
            Sign here
          </p>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={clear} disabled={isEmpty} icon={<Eraser className="size-3.5" />}>
          Clear
        </Button>
      </div>
    </div>
  );
}
