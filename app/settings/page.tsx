/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid a confirmed next/link runtime failure in the Sites vinext deployment. */
import { AccessibilitySettings } from '../../src/accessibility/settings';

export default function SettingsPage() {
  return <main className="preferences-page">
    <header><a className="brand" href="/">The Mahjong Room</a><nav><a href="/account">Account</a><a href="/">Back to the table</a></nav></header>
    <section className="preferences-shell"><p className="kicker">Comfort at every seat</p><h1>Make the table yours.</h1><p className="preferences-intro">A little more space. A gentler light. Settings that suit the way you play.</p><AccessibilitySettings /></section>
  </main>;
}
