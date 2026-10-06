import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const INSTALLED_KEY = 'dostana_reminders_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner:true, shouldShowList:true, shouldPlaySound:true, shouldSetBadge:false }),
});

export async function ensureOperationalReminders() {
  if (Platform.OS === 'web' || await AsyncStorage.getItem(INSTALLED_KEY)) return;
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('operations', {
      name:'Daily operations', importance:Notifications.AndroidImportance.DEFAULT,
    });
  }
  const reminders = [
    { hour:10, minute:0, title:'HACCP morning check', body:'Record required temperatures and hygiene checks.' },
    { hour:15, minute:0, title:'SPEC order check', body:'Review stock and submit the supplier order before cutoff.' },
    { hour:20, minute:0, title:'End-of-day report', body:'Review sales, employee hours, expenses and HACCP before closing.' },
  ];
  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      content:{ title:reminder.title, body:reminder.body, data:{screen:'Submit'} },
      trigger:{ type:Notifications.SchedulableTriggerInputTypes.DAILY, hour:reminder.hour, minute:reminder.minute, channelId:'operations' },
    });
  }
  await AsyncStorage.setItem(INSTALLED_KEY, new Date().toISOString());
}
