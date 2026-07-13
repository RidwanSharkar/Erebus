import { useCallback, useEffect, useRef } from 'react';
import { ROOM_TITLE_ANNOUNCEMENT_MS } from './coopRoomTitles';

export type QueueOverlayAnnouncement = (
  title: string,
  color: string,
  triggerKey?: string | number,
) => void;

interface QueuedAnnouncement {
  title: string;
  color: string;
  triggerKey?: string | number;
}

export function useAnnouncementQueue(queueOverlayAnnouncement: QueueOverlayAnnouncement) {
  const queueRef = useRef<QueuedAnnouncement[]>([]);
  const drainingRef = useRef(false);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayedTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const queueOverlayRef = useRef(queueOverlayAnnouncement);
  queueOverlayRef.current = queueOverlayAnnouncement;

  const clearDrainTimer = useCallback(() => {
    if (drainTimerRef.current !== null) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
  }, []);

  const cancelDelayedEnqueues = useCallback(() => {
    for (const timer of delayedTimersRef.current) {
      clearTimeout(timer);
    }
    delayedTimersRef.current = [];
  }, []);

  const drainRef = useRef<() => void>(() => {});

  const scheduleDrainCompletion = useCallback(() => {
    clearDrainTimer();
    drainTimerRef.current = setTimeout(() => {
      drainTimerRef.current = null;
      drainingRef.current = false;
      drainRef.current();
    }, ROOM_TITLE_ANNOUNCEMENT_MS);
  }, [clearDrainTimer]);

  const showAnnouncement = useCallback((item: QueuedAnnouncement) => {
    queueOverlayRef.current(
      item.title,
      item.color,
      item.triggerKey ?? `${item.title}-${Date.now()}`,
    );
  }, []);

  const drain = useCallback(() => {
    if (drainingRef.current || queueRef.current.length === 0) return;
    drainingRef.current = true;
    showAnnouncement(queueRef.current.shift()!);
    scheduleDrainCompletion();
  }, [showAnnouncement, scheduleDrainCompletion]);

  drainRef.current = drain;

  const enqueueAnnouncement = useCallback((
    title: string,
    color: string,
    triggerKey?: string | number,
  ) => {
    const item = { title, color, triggerKey };
    const isBusy = drainingRef.current || queueRef.current.length > 0;

    if (isBusy) {
      cancelDelayedEnqueues();
      queueRef.current = [];
      clearDrainTimer();
      drainingRef.current = true;
      showAnnouncement(item);
      scheduleDrainCompletion();
      return;
    }

    queueRef.current.push(item);
    drain();
  }, [
    drain,
    cancelDelayedEnqueues,
    clearDrainTimer,
    showAnnouncement,
    scheduleDrainCompletion,
  ]);

  const enqueueAnnouncementAfter = useCallback((
    delayMs: number,
    title: string,
    color: string,
    triggerKey?: string | number,
  ) => {
    const timer = setTimeout(() => {
      delayedTimersRef.current = delayedTimersRef.current.filter((t) => t !== timer);
      enqueueAnnouncement(title, color, triggerKey);
    }, delayMs);
    delayedTimersRef.current.push(timer);
  }, [enqueueAnnouncement]);

  useEffect(() => () => {
    clearDrainTimer();
    cancelDelayedEnqueues();
    queueRef.current = [];
    drainingRef.current = false;
  }, [clearDrainTimer, cancelDelayedEnqueues]);

  return { enqueueAnnouncement, enqueueAnnouncementAfter };
}
