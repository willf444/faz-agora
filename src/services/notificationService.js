import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { storageService } from './storageService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const notificationService = {
  async init() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Lembretes do WillDo',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
        sound: 'default',
        enableVibrate: true,
      });
    }
  },

  async requestPermissions() {
    await this.init();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  },

  async scheduleTaskNotification(task) {
    if (!task.due_at) return null;

    const triggerDate = new Date(task.due_at);
    const now = new Date();
    if (isNaN(triggerDate.getTime()) || triggerDate <= now) {
      return null;
    }

    try {
      // Cancela notificação anterior caso exista
      if (task.notificationId) {
        await this.cancelNotification(task.notificationId);
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ WillDo: Lembrete',
          body: task.title,
          data: { taskId: task.id },
          sound: 'default',
        },
        trigger: {
          date: triggerDate,
          channelId: 'default',
        },
      });

      return notificationId;
    } catch (error) {
      console.warn('Erro ao agendar notificação:', error);
      return null;
    }
  },

  async cancelNotification(notificationId) {
    if (!notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.warn('Erro ao cancelar notificação:', error);
    }
  },

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('Erro ao cancelar todas as notificações:', error);
    }
  },

  async rescheduleTasks(tasks) {
    await this.cancelAllNotifications();
    const refreshedTasks = [];

    for (const task of tasks) {
      const refreshedTask = { ...task, notificationId: null };
      if (!task.completed && task.due_at && new Date(task.due_at) > new Date()) {
        refreshedTask.notificationId = await this.scheduleTaskNotification(refreshedTask);
      }
      refreshedTasks.push(refreshedTask);
    }

    return await storageService.saveTasks(refreshedTasks);
  }
};
