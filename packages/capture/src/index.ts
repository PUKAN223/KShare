export interface CaptureConstraints {
  frameRate?: number;
  resolution?: "720p" | "1080p" | "4k";
  includeAudio?: boolean;
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
   * Request screen capture stream from user's browser
   */
  public async startCapture(
    options: CaptureConstraints = {}
  ): Promise<{ stream: MediaStream; metadata: CaptureMetadata }> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen capture API (getDisplayMedia) is not supported in this environment");
    }

    // Stop existing stream if running
    this.stopCapture();

    const {
      frameRate = 30,
      resolution = "1080p",
      includeAudio = true,
      suppressLocalAudioPlayback = false
    } = options;

    let width = 1920;
    let height = 1080;

    if (resolution === "720p") {
      width = 1280;
      height = 720;
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
        label: videoTrack.label || "Screen Stream",
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
   * Cleanly stop all tracks and cleanup
   */
  public stopCapture(): void {
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
