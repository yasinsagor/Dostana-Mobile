/* Voice and photo capture for AI search. Both return base64 data that the
   spec-ai-search function sends to OpenAI; nothing is stored. */
import { useEffect, useRef } from 'react';
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
  useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { readAsStringAsync } from 'expo-file-system/legacy';

export const MAX_VOICE_SECONDS = 30;

/* Tap to start, tap again to stop. Stops by itself after 30 seconds. */
export function useVoiceRecorder(onRecorded) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const stopping = useRef(false);
  const seconds = Math.floor((state.durationMillis || 0) / 1000);

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error('Allow the microphone for Dostana SPEC in the phone settings.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!recorder.uri) throw new Error('Nothing was recorded. Try again.');
      const audio = await readAsStringAsync(recorder.uri, { encoding: 'base64' });
      onRecorded?.({ audio, format: 'm4a' });
    } finally {
      stopping.current = false;
    }
  }

  useEffect(() => {
    if (state.isRecording && seconds >= MAX_VOICE_SECONDS) stop().catch(() => {});
  }, [state.isRecording, seconds]);

  return { recording: !!state.isRecording, seconds, start, stop };
}

/* Takes a photo (source "camera") or picks one ("library"), shrunk to 1024 px
   JPEG so it uploads quickly. Returns null when the manager cancels. */
export async function capturePhoto(source) {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(`Allow the ${source === 'camera' ? 'camera' : 'photos'} for Dostana SPEC in the phone settings.`);
  }
  const options = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const resize = (asset.width || 0) >= (asset.height || 0) ? { width: 1024 } : { height: 1024 };
  const small = await manipulateAsync(asset.uri, [{ resize }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
  return { image: small.base64, uri: small.uri };
}
