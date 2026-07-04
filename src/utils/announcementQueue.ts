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
  const queueOverlayRef = useRef(queueOverlayAnnouncement);
  queueOverlayRef.current = queueOverlayAnnouncement;

  const clearDrainTimer = useCallback(() => {
    if (drainTimerRef.current !== null) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
  }, []);

  const drain = useCallback(() => {
    if (drainingRef.current || queueRef.current.length === 0) return;
    drainingRef.current = true;
    const next = queueRef.current.shift()!;
    queueOverlayRef.current(
      next.title,
      next.color,
      next.triggerKey ?? `${next.title}-${Date.now()}`,
    );
    clearDrainTimer();
    drainTimerRef.current = setTimeout(() => {
      drainTimerRef.current = null;
      drainingRef.current = false;
      drain();
    }, ROOM_TITLE_ANNOUNCEMENT_MS);
  }, [clearDrainTimer]);

  const enqueueAnnouncement = useCallback((
    title: string,
    color: string,
    triggerKey?: string | number,
  ) => {
    queueRef.current.push({ title, color, triggerKey });
    drain();
  }, [drain]);

  const enqueueAnnouncementAfter = useCallback((
    delayMs: number,
    title: string,
    color: string,
    triggerKey?: string | number,
  ) => {
    setTimeout(() => {
      queueRef.current.push({ title, color, triggerKey });
      drain();
    }, delayMs);
  }, [drain]);

  useEffect(() => () => {
    clearDrainTimer();
    queueRef.current = [];
    drainingRef.current = false;
  }, [clearDrainTimer]);

  return { enqueueAnnouncement, enqueueAnnouncementAfter };
}
