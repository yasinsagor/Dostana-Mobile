import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../auth';
import { useSpec } from '../store';
import { aiMatch } from './api';
import { capturePhoto, useVoiceRecorder } from './media';

/* One AI search session: text, voice or photo in, matched products out.
   state: { status: 'idle'|'loading'|'done'|'error', source, query, photo, result, error } */
export function useAiSearch(mode = 'search') {
  const { user } = useAuth();
  const spec = useSpec();
  const [state, setState] = useState({ status: 'idle' });
  const seq = useRef(0);

  async function run(input, label) {
    const id = ++seq.current;
    const base = { source: input.source, query: label, photo: input.photoUri };
    setState({ ...base, status: 'loading' });
    try {
      const result = await aiMatch({
        branch: spec.branch, pin: user.pin, mode,
        query: input.query, audio: input.audio, audioFormat: input.audioFormat, image: input.image,
      });
      if (id === seq.current) setState({ ...base, status: 'done', result });
    } catch (e) {
      if (id === seq.current) setState({ ...base, status: 'error', error: e.message, retry: () => run(input, label) });
    }
  }

  const recorder = useVoiceRecorder(({ audio, format }) =>
    run({ audio, audioFormat: format, source: 'voice' }, 'your voice message'));

  async function startVoice() {
    try { await recorder.start(); }
    catch (e) { Alert.alert('Microphone', e.message || 'Could not start recording.'); }
  }
  async function stopVoice() {
    try { await recorder.stop(); }
    catch (e) { setState({ status: 'error', source: 'voice', error: e.message || 'Could not finish recording.' }); }
  }

  async function pick(source) {
    try {
      const photo = await capturePhoto(source);
      if (photo) run({ image: photo.image, source: 'photo', photoUri: photo.uri }, 'your photo');
    } catch (e) {
      Alert.alert('Photo', e.message || 'Could not open the camera.');
    }
  }
  function choosePhoto() {
    Alert.alert('Search with a photo', 'Photograph a product, its label, an empty box or your written list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Gallery', onPress: () => pick('library') },
      { text: 'Camera', onPress: () => pick('camera') },
    ]);
  }

  return {
    state,
    searchText: text => run({ query: text, source: 'text' }, text),
    voice: { recording: recorder.recording, seconds: recorder.seconds, start: startVoice, stop: stopVoice },
    choosePhoto,
    clear: () => { seq.current += 1; setState({ status: 'idle' }); },
  };
}
