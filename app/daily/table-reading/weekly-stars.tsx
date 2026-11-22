/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */
'use client';

import { useEffect, useState } from 'react';
import { weeklyTableStars } from '../../../src/game/weekly-table-stars';
import { PuzzleSolveBurst } from '../solve-burst';

export function WeeklyStars({ date, today, newStar, read }: { date: string; today: string; newStar: boolean; read: (key: string) => string | null }) {
  const [days, setDays] = useState<ReturnType<typeof weeklyTableStars>>([]);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    const refresh = () => {
      let next: ReturnType<typeof weeklyTableStars>;
      try {
        next = weeklyTableStars(date, today, read);
      } catch {
        next = weeklyTableStars(date, today, () => null);
      }
      setDays(next);
      if (newStar && next.every(day => day.earned)) {
        const key = `mahjong-room-week-complete-v1:${next[0].date}`;
        try {
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, '1');
        } catch { /* Celebrate during this visit when storage is unavailable. */ }
        setCelebrate(true);
      }
    };
    queueMicrotask(refresh);
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [date, today, newStar, read]);

  const count = days.filter(day => day.earned).length;
  return <section className={`weekly-stars${count === 7 ? ' weekly-stars-complete' : ''}`} aria-label="Weekly star collection">
    {celebrate ? <PuzzleSolveBurst /> : null}
    <div className="weekly-stars-heading" role="status"><h2>{count === 7 ? 'A perfect week!' : 'Your week of stars'}</h2><span>{count} / 7</span></div>
    <div className="weekly-stars-days">{days.map(day => {
      const label = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(day.date));
      const content = <><span>{label}</span><strong aria-hidden="true">{day.earned ? '★' : '☆'}</strong></>;
      const description = `${label}, ${day.date}, ${day.earned ? 'star earned' : day.available ? 'star available' : 'unavailable'}`;
      return day.available
        ? <a key={day.date} href={`/daily/table-reading?date=${day.date}`} aria-label={description} aria-current={day.date === date ? 'date' : undefined} className={day.earned ? 'weekly-star-earned' : undefined}>{content}</a>
        : <span key={day.date} aria-label={description} className="weekly-star-locked">{content}</span>;
    })}</div>
    {count === 7 ? <p>Seven sharp reads. Every star earned.</p> : <p>Earn a star with your first answer each day.</p>}
  </section>;
}
