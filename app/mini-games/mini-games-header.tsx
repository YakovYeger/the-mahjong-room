/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */

export function MiniGamesHeader({ playing = false }: { playing?: boolean }) {
  return <header className="mini-games-header">
    {playing
      ? <a className="mini-games-back" href="/mini-games">All mini-games</a>
      : <a className="brand" href="/">The Mahjong Room</a>}
    <a className="mini-games-back" href={playing ? '/' : '/daily/archive'}>{playing ? 'Home' : 'Puzzle archive'}</a>
  </header>;
}
