/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors are required by the Sites deployment. */
import type { ReactNode } from 'react';

export function GuideShell({ children, current }: { children: ReactNode; current: 'learn' | 'rules' }) {
  return <main className="guide-page">
    <header className="guide-header"><a className="brand" href="/">The Mahjong Room</a><nav aria-label="Learning navigation"><a href="/learn" aria-current={current === 'learn' ? 'page' : undefined}>Tutorial</a><a href="/rules" aria-current={current === 'rules' ? 'page' : undefined}>Rules</a><a href="/">Back to game</a></nav></header>
    {children}
    <footer className="guide-footer"><span>A little understanding. A more confident first hand.</span><a href="/">Back to game →</a></footer>
  </main>;
}
