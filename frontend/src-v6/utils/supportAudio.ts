export const SUPPORT_AUDIO_LIMIT = 5 * 1024 * 1024;
export const SUPPORT_AUDIO_SECONDS = 120;
export function recordingMime(recorder: Pick<typeof MediaRecorder, 'isTypeSupported'>): string | undefined {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => recorder.isTypeSupported(type));
}
