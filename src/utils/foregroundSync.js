export const FOREGROUND_SYNC_INTERVAL_MS = 3000;
export const SYNC_SUCCESS_MESSAGE = 'As tarefas foram sincronizadas com sucesso.';

export const shouldRescheduleAfterSync = (result, silent) => (
  Boolean(result?.changed) || !silent
);

export const startForegroundSync = (
  sync,
  setIntervalImplementation = setInterval
) => setIntervalImplementation(() => {
  void sync();
}, FOREGROUND_SYNC_INTERVAL_MS);
