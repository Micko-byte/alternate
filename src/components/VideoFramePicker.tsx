import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/** Lets a store scrub its dress video and keep the clearest frame as the try-on photo. */
export function VideoFramePicker({ file, onPick, onSkip }: { file: File; onPick: (frame: Blob) => void; onSkip: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onPick(blob);
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="grid gap-3 border border-rule bg-surface p-4">
      <p className="font-semibold">Pick the clearest frame of the piece</p>
      <p className="text-[14px] text-muted">Pause where the whole garment is visible and well lit. That frame becomes the photo shoppers try on.</p>
      {url && <video ref={videoRef} src={url} controls playsInline className="max-h-[420px] w-full bg-ink object-contain" />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="accent" onClick={capture} loading={busy}>
          Use this frame
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          Upload video only
        </Button>
      </div>
    </div>
  );
}
