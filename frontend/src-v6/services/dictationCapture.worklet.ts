// PCM capture runs off the UI thread. No audio file is created or uploaded.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  port: MessagePort;
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;

class DictationCapture extends AudioWorkletProcessor {
  private samples = new Float32Array(4096);
  private position = 0;
  private stopped = false;
  constructor() {
    super();
    this.port.onmessage = () => {
      this.stopped = true;
      if (this.position) this.port.postMessage({ samples: this.samples.slice(0, this.position), sampleRate });
      this.port.postMessage({ stopped: true });
    };
  }
  process(inputs: Float32Array[][]): boolean {
    if (this.stopped) return false;
    const channel = inputs[0]?.[0];
    if (channel) for (const sample of channel) {
      this.samples[this.position++] = sample;
      if (this.position === this.samples.length) {
        this.port.postMessage({ samples: this.samples, sampleRate }, [this.samples.buffer]);
        this.samples = new Float32Array(4096);
        this.position = 0;
      }
    }
    return true;
  }
}
registerProcessor('sitrep-dictation', DictationCapture);
export {};
