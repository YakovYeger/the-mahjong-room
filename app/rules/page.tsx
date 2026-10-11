/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors are required by the Sites deployment. */
import type { Metadata } from 'next';
import { GuideShell } from '../../src/learn/guide-shell';

export const metadata: Metadata = { title: 'Rules & game stages — The Mahjong Room', description: 'A readable reference to the tiles, Charleston, turns, calling, Jokers, and winning in The Mahjong Room.' };

const sections = [
  { id: 'goal', title: '1. Goal & selected card', rules: [
    'Four players build toward a winning hand of exactly 14 physical tiles from the card selected for that game. Your concealed rack and exposed sets both count.',
    'The original Training Card contains 10 guided hands. The 2025 Card contains 55 reference lines with their allowed variations. The card’s patterns, suit requirements, notes, and concealed/exposed designation determine what is legal; do not mix lines or cards.',
    'You may change your target hand during play, but every exposure must remain compatible with the new target. Coach suggestions cannot guarantee that unseen tiles will become available.',
  ] },
  { id: 'tiles', title: '2. Tiles & matching', rules: [
    'The 152-tile set has 108 numbered tiles: Bams (Bamboo), Craks (Characters), and Dots, each ranked 1–9 with four copies of every rank in every suit. The bird is 1 Bam.',
    'There are 16 Winds (four each of East, South, West, North), 12 Dragons (four each of Red, Green, White), eight interchangeable Flowers, and eight Jokers. White Dragon is also called Soap.',
    'Numbered tiles match only when rank and suit both match. Winds and Dragons match their own type. All Flowers match each other regardless of illustration or number.',
    'When a card specifies matching Dragons: Bams match Green, Craks match Red, and Dots match White. Opposite Dragons come from the other suits; follow the card note.',
  ] },
  { id: 'card', title: '3. Groups & card notation', rules: [
    'A single contains one tile; a pair two; a pung three; a kong four; a quint five; and a sextet six. Pungs and larger groups contain identical tiles, with eligible Jokers substituting for matching natural tiles.',
    'Singles and pairs must be natural. A consecutive run (such as 123) consists of separate singles, not a callable group. Numbered quints and sextets need Jokers because only four copies of each natural tile exist. Flower groups can use up to eight natural Flowers.',
    'On the 2025 Card, F denotes Flower, D Dragon, N/E/W/S Winds, and 0 White Dragon in year patterns. Card ink colors indicate relative suits, not tile artwork colors. Notes define allowed numbers and suit relationships.',
    'X identifies an exposed hand: eligible groups may be called, but calls are not required. C identifies a concealed hand: no ordinary exposure calls, though the final natural discard may be claimed for Mahjong. Concealed pungs and larger identical groups may still use Jokers.',
    'Card values are shown as a reference. This app does not calculate formal scoring or payments.',
  ] },
  { id: 'deal', title: '4. Seats, deal & opening', rules: [
    'The app shuffles and deals automatically. East receives 14 tiles; South, West, and North receive 13. Solo practice seats you in East. Seat names do not restrict which Wind tiles you may collect.',
    'Normal turn order is East → South → West → North. After the Charleston, East begins by discarding without drawing. An East hand already matching the card on the initial deal may declare Mahjong before passing.',
  ] },
  { id: 'charleston', title: '5. Charleston & courtesy pass', rules: [
    'The first Charleston passes three tiles Right, Across, Left. Choose tiles from your rack; each completed pass exchanges the same total, preserving hand size. Jokers cannot be passed. Flowers, Winds, Dragons, and numbered tiles may be passed.',
    'On the final Left pass, one or two blind spaces may replace chosen rack tiles. Incoming tiles fill these spaces and are forwarded without being examined. You must choose at least one rack tile in this app.',
    'A second Charleston requires unanimous agreement. East records the table’s decision in the interface. If continuing, pass three tiles Left, Across, Right. One or two blind spaces are available on that final Right pass.',
    'After stopping or completing the second Charleston, opposite players may make a courtesy pass of zero to three tiles, with no Jokers or blind spaces. Partners exchange the same count. The app uses the lower offered count if offers differ; surplus chosen tiles return to their owner.',
    'No drawing, discarding, ordinary calling, or Joker exchange happens during the Charleston. Normal play begins after the courtesy pass resolves.',
  ] },
  { id: 'turn', title: '6. A normal turn', rules: [
    'Between turns you have 13 total tiles, including exposures. On your active turn with no pending discard response, draw one from the wall to reach 14. A successful call takes the place of that draw.',
    'At 14, you may make legal Joker exchanges and declare a valid Mahjong. Otherwise discard exactly one tile from your concealed rack, returning to 13. Tiles already in exposures cannot be discarded.',
    'A called kong does not earn a replacement draw. Neither do other called groups: calling adds one physical tile, so discard next unless you win.',
    'Every discard opens a response window for the other three players. Drawing waits until those responses resolve. If nobody claims it, the next player in turn order draws.',
  ] },
  { id: 'calls', title: '7. Discards, calls & priority', rules: [
    'Only the latest discard can be claimed while its response window is open. You cannot claim your own discard, an older discard, or a discarded Joker. Passing closes your response for that tile.',
    'An ordinary call must use the discard and tiles from your concealed rack to complete an entire pung, kong, quint, or sextet required by at least one viable, exposure-compatible hand on the selected card. Eligible rack Jokers may help complete it.',
    'You cannot call for an ordinary single, pair, consecutive run, or concealed hand. Natural Flowers may complete an eligible Flower group. A final natural tile needed for Mahjong is an exception to the single, pair, and concealed restrictions.',
    'The app records all eligible responses before resolving them. Mahjong beats an exposure call. Among competing claims with equal priority, the player nearest after the discarder in turn order wins.',
    'A successful caller exposes the whole group, then discards without drawing. Play continues from that caller, so other seats may be skipped. An exposure stays committed to its group; the app does not allow resizing it after calling.',
    'The discard pool is chronological public history. Claimed tiles move to the caller’s hand and leave the pool; older unclaimed tiles remain visible for reference, not later collection.',
  ] },
  { id: 'jokers', title: '8. Jokers & exchanges', rules: [
    'Jokers substitute only in identical groups of three or more: pungs, kongs, quints, and sextets, including eligible Flower groups. They cannot fill singles, pairs, or individual positions in consecutive runs or year patterns.',
    'Never pass a Joker in the Charleston or courtesy pass. You may discard a Joker in normal play, but it is dead: no player can call it, even for Mahjong.',
    'On your active turn after drawing or successfully calling, and before discarding, a matching natural rack tile may replace a Joker in anyone’s exposed group, including your own. The Joker moves to your rack and your tile count stays the same.',
    'The replacement must match the natural tiles represented by that exposure. Any natural Flower may redeem a Joker in an exposed Flower group. You cannot use a discard directly to redeem a Joker or exchange one from a concealed hand.',
  ] },
  { id: 'win', title: '9. Mahjong & wall games', rules: [
    'Mahjong requires exactly 14 physical tiles matching one complete hand on the selected card, with legal Joker placement and compatible exposures. Declare Mahjong instead of discarding when your hand is complete.',
    'You may win after drawing, after a legal Joker exchange, or by claiming another player’s latest natural discard during its response window. That discard may complete a single or pair, and may finish a concealed hand.',
    'A valid Mahjong ends the game with a winner. If the next draw finds the wall empty, the game ends without a winner: a wall game. Final racks are revealed; solo practice also offers a coach review.',
  ] },
  { id: 'learning', title: '10. Learning safeguards & information', rules: [
    'The app blocks illegal moves before they happen instead of accepting them and applying physical-table dead-hand penalties. The coach uses your rack and public information, never another player’s concealed rack. Bots follow the same core legality checks.',
    'A dead-hand notice appears only when discarded-tile counts make every exposure-compatible line impossible. It deliberately excludes opponent racks and exposures from that calculation. No notice is not a promise that your hand remains achievable.',
    'Rearranging your rack changes its display order only. Hints are optional and do not change the winning rules. The tutorial uses separate examples and does not alter your saved game.',
  ] },
  { id: 'cloud', title: '11. Private tables & timing', rules: [
    'Cloud tables require an account. The host chooses the card and mode before starting; bots fill open seats. The same tile, Charleston, calling, Joker, and winning rules apply.',
    'Live tables show their configured turn limit in the lobby; time-based tables use 24-hour turns. The Charleston is untimed. In live play, a disconnected player has a two-minute reconnect grace period before bot takeover. Follow the table’s status and deadline prompts.',
    'Timed-out actions may be resolved automatically; repeated timeouts can transfer a seat to a bot. A host-ended or abandoned table may end without Mahjong; that is a session end rather than a winning hand.',
  ] },
  { id: 'scope', title: '12. Physical-table rules & scope', rules: [
    'This reference covers the game implemented in The Mahjong Room, based on American Mah Jongg mechanics. It is not a complete tournament rulebook. The Training Card is original; it is not the annual commercial card.',
    'Dice, breaking walls, spoken tile naming, touching/racking commitment, misnamed-discard penalties, formal payments, scoring, seat rotation across games, and tournament-specific penalties are outside the app. So are resizing a newly made exposure and the rare all-four-player fully blind Charleston procedure.',
    'For physical-table play or formal disputes, use your current card and the National Mah Jongg League’s official rule materials. House and tournament procedures may differ from this guided interface.',
  ] },
];

export default function RulesPage() {
  return <GuideShell current="rules"><section className="guide-intro"><p className="kicker">Your table reference</p><h1>The rules.<br /><em>The whole path through a hand.</em></h1><p>Read in order or jump to the decision in front of you. These rules describe the game you can play here.</p><a href="/learn">New to Mahjong? Start with the illustrated tutorial →</a></section><div className="rules-layout"><nav className="rules-nav" aria-label="Rules contents">{sections.map(section => <a key={section.id} href={`/rules#${section.id}`}>{section.title}</a>)}</nav><div className="rules-content"><div className="guide-note"><strong>Stages at a glance</strong><p>Choose a card → deal → first Charleston → optional second Charleston → courtesy pass → East’s opening discard → draw/call and discard turns → Mahjong or wall game.</p></div>{sections.map(section => <section id={section.id} key={section.id}><h2>{section.title}</h2><ul>{section.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></section>)}<p className="rules-source">For official physical-table materials, visit the <a href="https://www.nationalmahjonggleague.org/" target="_blank" rel="noreferrer">National Mah Jongg League ↗</a>.</p><a className="guide-primary" href="/">Play or resume your game →</a></div></div></GuideShell>;
}
