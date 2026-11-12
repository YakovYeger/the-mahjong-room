/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */
import { formatPuzzleDate, puzzleArchive, puzzleDate } from '../../../src/game/puzzle-catalog';
import '../daily.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Puzzle Archive · The Mahjong Room' };

export default async function PuzzleArchivePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const today = puzzleDate();
  const { entries, page, pages } = puzzleArchive(today, Number((await searchParams).page ?? 1));
  return <main className="daily-page">
    <header className="daily-top"><a className="brand" href="/">The Mahjong Room</a><a href="/daily">Today’s puzzle</a></header>
    <div className="daily-layout">
      <header className="daily-intro"><span className="daily-seal" aria-hidden="true">✦</span><p className="kicker">The puzzle collection</p><h1>Puzzle archive</h1><p>Pick a date to revisit its original rack.</p></header>
      <section className="daily-archive-challenges" aria-label="Table reading collection">
        <a className="daily-table-reading-link" href="/daily/table-reading"><span><strong>Would you throw it?</strong><small>Three table-reading challenges · Easy to hard</small></span><span aria-hidden="true">→</span></a>
      </section>
      <ul className="daily-archive-list">{entries.map(entry => <li key={entry.date}><a href={`/daily/${entry.date}`}><div><strong><time dateTime={entry.date}>{formatPuzzleDate(entry.date)}</time>{entry.date === today ? ' · Today' : ''}</strong><small>Discard puzzle · {entry.hand.section}</small></div><span aria-hidden="true">→</span></a></li>)}</ul>
      {pages > 1 ? <nav className="daily-archive-pagination" aria-label="Archive pages">
        {page > 1 ? <a href={`/daily/archive?page=${page - 1}`}>← Newer</a> : <span />}
        <span>Page {page} of {pages}</span>
        {page < pages ? <a href={`/daily/archive?page=${page + 1}`}>Older →</a> : <span />}
      </nav> : null}
    </div>
  </main>;
}
