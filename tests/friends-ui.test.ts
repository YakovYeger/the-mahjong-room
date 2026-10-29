// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FriendsPage from '../app/friends/page';
const mocks=vi.hoisted(()=>({change:vi.fn(),refetch:vi.fn(),hook:vi.fn()}));
vi.mock('../src/friends/use-friends',()=>({useFriends:(name:string)=>mocks.hook(name)}));
const person=(username:string,relationship:string)=>({username,displayName:username==='alice'?'Alice':'June',memberSince:'2026-10-01T00:00:00Z',relationship,connectionId:relationship==='self'?null:'20000000-0000-4000-8000-000000000001'});
beforeEach(()=>{vi.resetAllMocks();mocks.change.mockResolvedValue({});mocks.hook.mockImplementation(()=>({userId:'alice',loading:false,isPending:false,isFetching:false,busy:false,error:null,change:mocks.change,refetch:mocks.refetch,data:{self:person('alice','self'),lookup:person('june','none'),connections:[person('june','friends')]}}));});
afterEach(cleanup);
it('searches normalized usernames only on form submission and associates validation errors',async()=>{
 const user=userEvent.setup();render(createElement(FriendsPage));const input=screen.getByRole('textbox',{name:'Exact username'});
 await user.type(input,'j%');await user.click(screen.getByRole('button',{name:'Find player'}));expect(input.getAttribute('aria-invalid')).toBe('true');expect(screen.getByRole('alert').id).toBeTruthy();
 await user.clear(input);await user.type(input,'JUNE');await user.click(screen.getByRole('button',{name:'Find player'}));expect(mocks.hook).toHaveBeenLastCalledWith('june');
});
it('requires confirmation to remove a friend and Escape preserves the friendship',async()=>{
 const user=userEvent.setup();render(createElement(FriendsPage));await user.click(screen.getByRole('button',{name:'Remove @june'}));expect(screen.getByRole('dialog')).toBeTruthy();expect(mocks.change).not.toHaveBeenCalled();await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(mocks.change).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Remove @june'}));await user.click(screen.getByRole('button',{name:'Remove friend'}));expect(mocks.change).toHaveBeenCalledWith({username:'june',operation:'remove',connectionId:'20000000-0000-4000-8000-000000000001'});
});
it('replaces private content with the sign-in state after session loss',()=>{
 mocks.hook.mockReturnValue({loading:false,userId:null});render(createElement(FriendsPage));expect(screen.getByRole('link',{name:'Sign in or create an account'})).toBeTruthy();expect(screen.queryByText('@alice')).toBeNull();
});
