export interface CaptureConstraints {
  frameRate?: number;
  resolution?: "720p" | "1080p" | "1440p" | "4k";
  includeAudio?: boolean;
  contentHint?: "detail" | "motion" | "text";
  suppressLocalAudioPlayback?: boolean;
}

export interface MicCaptureOptions {
  deviceId?: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
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

function getResolutionDimensions(resolution: "720p" | "1080p" | "1440p" | "4k") {
  switch (resolution) {
    case "720p":
      return { width: 1280, height: 720 };
    case "1440p":
      return { width: 2560, height: 1440 };
    case "4k":
      return { width: 3840, height: 2160 };
    case "1080p":
    default:
      return { width: 1920, height: 1080 };
  }
}

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

  public getCurrentStream(): MediaStream | null {
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
      throw new Error("เบราว์เซอร์หรือการเชื่อมต่อนี้ไม่รองรับการแชร์หน้าจอ (ต้องเปิดผ่าน localhost หรือ HTTPS)");
    }

    this.stopCapture();

    const {
      frameRate = 60,
      resolution = "1080p",
      includeAudio = true,
      contentHint = "detail",
      suppressLocalAudioPlayback = false
    } = options;

    const { width, height } = getResolutionDimensions(resolution);

    const displayMediaOptions: DisplayMediaStreamOptions = {
      video: {
        width: { ideal: width, max: width },
        height: { ideal: height, max: height },
        frameRate: { ideal: frameRate, max: 60 }
      },
      audio: includeAudio
        ? {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            // @ts-expect-error non-standard Chrome property
            suppressLocalAudioPlayback
          }
        : false
    };

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      this.activeStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error("ไม่พบสัญญาณภาพจากหน้าจอที่เลือก");
      }

      if ("contentHint" in videoTrack) {
        videoTrack.contentHint = contentHint;
      }

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
        frameRate: Math.round(settings.frameRate || frameRate),
        label: videoTrack.label || "Screen Share",
        hasAudio: stream.getAudioTracks().length > 0,
        displaySurface: settings.displaySurface
      };

      return { stream, metadata };
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "NotAllowedError") {
        throw new Error("ยกเลิกการเลือกหน้าจอ หรือไม่อนุญาตสิทธิ์แชร์หน้าจอ");
      } else if (error.name === "NotFoundError") {
        throw new Error("ไม่พบหน้าจอหรือหน้าต่างสำหรับแชร์");
      }
      throw error;
    }
  }

  /**
   * Dynamically update resolution, frameRate, and contentHint on a live capture track
   */
  public async applyVideoSettings(options: {
    resolution?: "720p" | "1080p" | "1440p" | "4k";
    frameRate?: number;
    contentHint?: "detail" | "motion" | "text";
  }): Promise<CaptureMetadata | null> {
    if (!this.activeStream) return null;
    const videoTrack = this.activeStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") return null;

    if (options.contentHint && "contentHint" in videoTrack) {
      videoTrack.contentHint = options.contentHint;
    }

    const constraints: MediaTrackConstraints = {};
    if (options.resolution) {
      const { width, height } = getResolutionDimensions(options.resolution);
      constraints.width = { ideal: width, max: width };
      constraints.height = { ideal: height, max: height };
    }
    if (options.frameRate) {
      constraints.frameRate = { ideal: options.frameRate, max: 60 };
    }

    try {
      if (Object.keys(constraints).length > 0) {
        await videoTrack.applyConstraints(constraints);
      }
    } catch {
      // Some browsers restrict live resolution constraint changes on screen tracks
    }

    const settings = videoTrack.getSettings();
    return {
      width: settings.width || 1920,
      height: settings.height || 1080,
      frameRate: Math.round(settings.frameRate || options.frameRate || 60),
      label: videoTrack.label || "Screen Share",
      hasAudio: this.activeStream.getAudioTracks().length > 0,
      displaySurface: settings.displaySurface
    };
  }

  /**
   * Pause/Resume video track transmission (Privacy / Freeze screen)
   */
  public setVideoPaused(paused: boolean): void {
    if (!this.activeStream) return;
    this.activeStream.getVideoTracks().forEach((track) => {
      track.enabled = !paused;
    });
  }

  /**
   * Enable/Disable system audio track
   */
  public setSystemAudioEnabled(enabled: boolean): void {
    if (!this.activeStream) return;
    const micTrackIds = new Set(this.micStream?.getAudioTracks().map((t) => t.id) || []);
    this.activeStream.getAudioTracks().forEach((track) => {
      if (!micTrackIds.has(track.id)) {
        track.enabled = enabled;
      }
    });
  }

  /**
   * Capture teacher's microphone and attach to the active stream
   */
  public async addMicrophoneTrack(
    options: MicCaptureOptions = {}
  ): Promise<MediaStreamTrack | null> {
    if (!navigator.mediaDevices?.getUserMedia || !this.activeStream) return null;
    this.removeMicrophoneTrack();

    const {
      deviceId,
      echoCancellation = true,
      noiseSuppression = true,
      autoGainControl = true
    } = options;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation,
          noiseSuppression,
          autoGainControl
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

export const captureManager = new ScreenCaptureManager();
