'use client';

import { useEffect, useState } from 'react';

const TOTAL_MS = 4100;
const ENTER_MS = 600;
const HOLD_MS = 2800;

interface RoomTitleAnnouncementProps {
  /** Unique key per show — changing this restarts the animation */
  triggerKey: string | number;
  title: string;
  color: string;
}

export default function RoomTitleAnnouncement({
  triggerKey,
  title,
  color,
}: RoomTitleAnnouncementProps) {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    setMounted(true);
    const timer = window.setTimeout(() => setMounted(false), TOTAL_MS);
    return () => window.clearTimeout(timer);
  }, [triggerKey]);

  if (!mounted) return null;

  const enterEnd = (ENTER_MS / TOTAL_MS) * 100;
  const holdEnd = ((ENTER_MS + HOLD_MS) / TOTAL_MS) * 100;

  return (
    <div className="fixed inset-x-0 top-[14vh] z-[350] flex justify-center pointer-events-none">
      <div className="flex items-center gap-3 md:gap-4 px-4 max-w-[92vw]">
        <div
          className="hidden sm:block h-px w-12 md:w-16 opacity-60"
          style={{ background: `linear-gradient(to right, transparent, ${color})` }}
        />
        <h2
          className="room-title-announce font-mono font-black uppercase text-xl sm:text-2xl md:text-3xl whitespace-nowrap text-center"
          style={{
            color,
            textShadow: `0 0 20px ${color}aa, 0 0 40px ${color}55, 0 2px 8px rgba(0,0,0,0.85)`,
          }}
        >
          {title}
        </h2>
        <div
          className="hidden sm:block h-px w-12 md:w-16 opacity-60"
          style={{ background: `linear-gradient(to left, transparent, ${color})` }}
        />
      </div>

      <style jsx>{`
        .room-title-announce {
          animation: roomTitleAnnounce ${TOTAL_MS}ms ease-in-out forwards;
          letter-spacing: 0.25em;
        }

        @keyframes roomTitleAnnounce {
          0% {
            opacity: 0;
            transform: translateY(28px) scale(0.9);
            letter-spacing: 0.42em;
          }
          ${enterEnd}% {
            opacity: 1;
            transform: translateY(0) scale(1);
            letter-spacing: 0.25em;
          }
          ${holdEnd}% {
            opacity: 1;
            transform: translateY(0) scale(1);
            letter-spacing: 0.25em;
          }
          100% {
            opacity: 0;
            transform: translateY(-24px) scale(0.92);
            letter-spacing: 0.3em;
          }
        }
      `}</style>
    </div>
  );
}
