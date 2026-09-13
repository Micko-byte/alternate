/** Grabs a still frame from a video file (default: 30% in, past intros and blur). */
export function extractVideoFrame(file: File, at = 0.3): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that video"));
    };
    video.onerror = fail;
    video.onloadedmetadata = () => {
      video.currentTime = Math.max(0, Math.min(video.duration * at, video.duration - 0.1));
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("Could not capture a frame"));
        },
        "image/jpeg",
        0.9,
      );
    };
  });
}
