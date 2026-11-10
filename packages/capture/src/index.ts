export interface CaptureConstraints {
  frameRate?: number;
  resolution?: "720p" | "1080p" | "1440p" | "4k";
  includeAudio?: boolean;
  contentHint?: "detail" | "motion" | "text";
  suppressLocalAudioPlayback?: boolean;
}

export interface CaptureMetadata {
  width: number;
  height: number;
  frameRate?: number;
  label: string;
  hasAudio: boolean;
  displaySurface?: string;
}

export type CaptureEndedCallback = () => void;

export class ScreenCaptureManager {
  private activeStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private onEndedCallback: CaptureEndedCallback | null = null;

  public isCapturing(): boolean {
    return (
      this.activeStream !== null &&
      this.activeStream.getVideoTracks().some((t) => t.readyState === "live")
    );
  }

  public getStream(): MediaStream | null {
    return this.activeStream;
  }

  public onEnded(callback: CaptureEndedCallback): void {
    this.onEndedCallback = callback;
  }

  /**
   * Request screen capture stream from user's browser with rich settings
   */
  public async startCapture(
    options: CaptureConstraints = {}
  ): Promise<{ stream: MediaStream; metadata: CaptureMetadata }> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen capture API (getDisplayMedia) is not supported in this environment");
    }

    this.stopCapture();

    const {
      frameRate = 30,
      resolution = "1080p",
      includeAudio = true,
      contentHint = "detail",
      suppressLocalAudioPlayback = false
    } = options;

    let width = 1920;
    let height = 1080;

    if (resolution === "720p") {
      width = 1280;
      height = 720;
    } else if (resolution === "1440p") {
      width = 2560;
      height = 1440;
    } else if (resolution === "4k") {
      width = 3840;
      height = 2160;
    }

    const displayMediaOptions: DisplayMediaStreamOptions = {
      video: {
        width: { ideal: width, max: width },
        height: { ideal: height, max: height },
        frameRate: { ideal: frameRate, max: 60 }
      },
      audio: includeAudio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // @ts-expect-error non-standard browser property
            suppressLocalAudioPlayback
          }
        : false
    };

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      this.activeStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("No video track found in captured screen stream");
      }

      // Apply contentHint optimization (detail for slides/code, motion for video)
      if ("contentHint" in videoTrack) {
        videoTrack.contentHint = contentHint;
      }

      // Handle user stopping share via browser native banner
      videoTrack.addEventListener("ended", () => {
        this.stopCapture();
        if (this.onEndedCallback) {
          this.onEndedCallback();
        }
      });

      const settings = videoTrack.getSettings();
      const metadata: CaptureMetadata = {
        width: settings.width || width,
        height: settings.height || height,
        frameRate: settings.frameRate || frameRate,
        label: videoTrack.label || "SCiUS Screen Stream",
        hasAudio: stream.getAudioTracks().length > 0,
        displaySurface: settings.displaySurface
      };

      return { stream, metadata };
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "NotAllowedError") {
        throw new Error("ผู้ใช้งานยกเลิกหรือไม่อนุญาตการแชร์หน้าจอ (Permission Denied)");
      } else if (error.name === "NotFoundError") {
        throw new Error("ไม่พบหน้าจอหรืออุปกรณ์แสดงผลสำหรับการแชร์");
      }
      throw error;
    }
  }

  /**
   * Optionally capture teacher's microphone and merge it into the active stream
   */
  public async addMicrophoneTrack(): Promise<MediaStreamTrack | null> {
    if (!navigator.mediaDevices?.getUserMedia || !this.activeStream) return null;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const micTrack = this.micStream.getAudioTracks()[0];
      if (micTrack) {
        this.activeStream.addTrack(micTrack);
        return micTrack;
      }
      return null;
    } catch {
      return null;
    }
  }

  public removeMicrophoneTrack(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        try {
          track.stop();
          this.activeStream?.removeTrack(track);
        } catch {
          // ignore
        }
      });
      this.micStream = null;
    }
  }

  /**
   * Cleanly stop all tracks and cleanup
   */
  public stopCapture(): void {
    this.removeMicrophoneTrack();
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.activeStream = null;
    }
  }
}
