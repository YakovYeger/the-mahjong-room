'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid the Sites/Vinext next/link runtime failure. */
import { useId, useState, type FormEvent } from 'react';
import { useFriends } from '../../src/friends/use-friends';
import { usernameSchema, type PlayerProfile, type FriendAction } from '../../src/friends/contracts';
import { CloudApiError } from '../../src/multiplayer/cloud-api';
import { Button, buttonVariants } from '../../src/ui/button';
import { Input } from '../../src/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../src/ui/field';
import { Dialog, DialogTitle, DialogDescription } from '../../src/ui/dialog';
import './friends.css';

export default function FriendsPage() {
  const id = useId();
  const [input,setInput] = useState('');
  const [searched,setSearched] = useState('');
  const [inputError,setInputError] = useState('');
  const [message,setMessage] = useState('');
  const [actionError,setActionError] = useState('');
  const [removing,setRemoving] = useState<PlayerProfile|null>(null);
  const friends = useFriends(searched);
  const signedOut = !friends.loading && (!friends.userId || (friends.error instanceof CloudApiError && friends.error.status===401));
  const change = async (player:PlayerProfile, operation:FriendAction['operation']) => {
    setMessage('');setActionError('');
    try {
      const updated = await friends.change(operation==='request' ? {username:player.username,operation} : {username:player.username,operation,connectionId:player.connectionId!});
      setMessage(({request:updated.lookup?.relationship==='incoming' ? 'This player has already requested you. Accept their request below.' : updated.lookup?.relationship==='friends' ? 'You are already friends.' : 'Friend request sent.',accept:'Friend request accepted.',decline:'Friend request declined.',cancel:'Friend request cancelled.',remove:'Friend removed.'})[operation]);setRemoving(null);
    } catch(error) {setActionError(error instanceof Error ? error.message : 'Refresh your list to confirm the change.');}
  };
  const search = (event:FormEvent) => {
    event.preventDefault();setInputError('');setMessage('');setActionError('');
    const parsed = usernameSchema.safeParse(input);
    if (!parsed.success) {setInputError('Use an exact username: 3–24 letters, numbers, or underscores.');return;}
    if(parsed.data===searched) void friends.refetch(); else setSearched(parsed.data);
  };
  const card = (player:PlayerProfile, own=false) => <article className="friend-card" key={player.username}>
    <div className="friend-avatar" aria-hidden="true">{player.displayName.slice(0,1).toUpperCase()}</div>
    <div className="friend-details"><h3>{player.displayName}</h3><p>@{player.username}</p><small>Joined {new Date(player.memberSince).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}{own ? ' · Your profile' : ''}</small></div>
    {!own ? <div className="friend-actions">
      {player.relationship==='none' ? <Button disabled={friends.busy} onClick={()=>void change(player,'request')}>Add friend</Button> : null}
      {player.relationship==='incoming' ? <><Button disabled={friends.busy} onClick={()=>void change(player,'accept')}>Accept <span className="friend-sr">@{player.username}</span></Button><Button variant="outline" disabled={friends.busy} onClick={()=>void change(player,'decline')}>Decline <span className="friend-sr">@{player.username}</span></Button></> : null}
      {player.relationship==='outgoing' ? <><span>Request sent</span><Button variant="outline" disabled={friends.busy} onClick={()=>void change(player,'cancel')}>Cancel request <span className="friend-sr">to @{player.username}</span></Button></> : null}
      {player.relationship==='friends' ? <><span>Friends</span><Button variant="ghost" disabled={friends.busy} onClick={()=>{setActionError('');setRemoving(player);}}>Remove <span className="friend-sr">@{player.username}</span></Button></> : null}
    </div> : null}
  </article>;
  return <main className="friends-page">
    <header><a className="brand" href="/">The Mahjong Room</a><nav aria-label="Account navigation"><a href="/games">My games</a><a href="/account">Account</a><a href="/">Back to the table</a></nav></header>
    <div className="friends-shell"><p className="kicker">Good company at the table</p><h1>Your Mahjong circle.</h1><p className="friends-intro">Find someone you know, exchange friend requests, and keep your regular players close.</p>
    {friends.loading ? <p role="status">Checking your account…</p> : signedOut ? <section className="friends-section"><h2>A seat for your friends.</h2><p>Sign in to find players by username and save your friends across devices.</p><a className={buttonVariants()} href="/account">Sign in or create an account</a></section> : <>
      {friends.error ? <div className="friends-section" role="alert"><p>{friends.error.message}</p><Button variant="outline" onClick={()=>void friends.refetch()} disabled={friends.isFetching}>Try again</Button><a href="/account">Open account</a></div> : null}
      {friends.isPending ? <p role="status">Loading your circle…</p> : null}
      {friends.data ? <>
        <section className="friends-section" aria-labelledby={`${id}-profile`}><h2 id={`${id}-profile`}>Your player profile</h2><p>Players can find you by your username. Only your name, username, and join date are shared.</p>{card(friends.data.self,true)}<a href="/account">Edit your display name</a></section>
        <section className="friends-section" aria-labelledby={`${id}-find`}><h2 id={`${id}-find`}>Find a player</h2><form onSubmit={search}><FieldGroup><Field><FieldLabel htmlFor={`${id}-username`}>Exact username</FieldLabel><FieldDescription id={`${id}-hint`}>Ask your friend for their username. Email addresses and partial names are not searched.</FieldDescription><div className="friend-search"><Input id={`${id}-username`} value={input} onChange={event=>{setInput(event.target.value);setInputError('');}} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={24} aria-invalid={Boolean(inputError)} aria-describedby={`${id}-hint${inputError?` ${id}-error`:''}`} required /><Button type="submit" disabled={friends.busy || friends.isFetching}>Find player</Button></div><FieldError id={`${id}-error`}>{inputError}</FieldError></Field></FieldGroup></form>
          {searched ? <div className="friend-search-result" aria-live="polite">{friends.isFetching ? <p>Looking for @{searched}…</p> : friends.error ? null : friends.data.lookup ? <><p>Player profile</p>{card(friends.data.lookup,friends.data.lookup.relationship==='self')}</> : <p>No player found for @{searched}. Check the exact username with your friend.</p>}</div> : null}
        </section>
        <p role="status" className="friend-status">{message}</p><FieldError>{actionError}</FieldError>
        {(['incoming','outgoing','friends'] as const).map(kind=>{const players=friends.data!.connections.filter(player=>player.relationship===kind);return <section className="friends-section" key={kind} aria-labelledby={`${id}-${kind}`}><h2 id={`${id}-${kind}`}>{kind==='incoming'?'Friend requests':kind==='outgoing'?'Sent requests':'Your friends'} <span>{players.length}</span></h2>{players.length ? <div className="friend-list">{players.map(player=>card(player))}</div> : <p>{kind==='incoming'?'No requests waiting.':kind==='outgoing'?'No pending requests sent.':'Your circle starts with one friend. Find their username above.'}</p>}</section>;})}
        <p className="friends-footnote">Refreshes while this page is open. Friends do not automatically join your tables; share a private table’s invite code when you want to play.</p>
      </> : null}
    </>}
    </div>
    <Dialog open={Boolean(removing)} onOpenChange={open=>{if(!open&&!friends.busy)setRemoving(null);}} className="accessibility-dialog">
      <DialogTitle>Remove {removing?.displayName}?</DialogTitle><DialogDescription>This removes the friendship for both players. It won’t change any shared games.</DialogDescription><FieldError>{actionError}</FieldError><div className="friend-dialog-actions"><Button variant="outline" disabled={friends.busy} onClick={()=>setRemoving(null)}>Keep friend</Button><Button variant="destructive" disabled={friends.busy} onClick={()=>removing&&void change(removing,'remove')}>Remove friend</Button></div>
    </Dialog>
  </main>;
}
