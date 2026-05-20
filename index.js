import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { registerRootComponent } from 'expo';

import App from './App';

if (global.ErrorUtils) {
  const prev = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    global.__FATAL_ERROR__ = (error?.toString() || 'unknown') + '\n\n' + (error?.stack || '');
    if (prev) prev(error, isFatal);
  });
}

enableScreens();
registerRootComponent(App);
