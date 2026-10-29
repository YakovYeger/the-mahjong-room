'use client';
import { useMutation, useQuery, useQueryClient, onlineManager } from '@tanstack/react-query';
import { useCloudSession } from '../multiplayer/cloud-query-provider';
import { cloudJson, CloudApiError, ContractError, isTransientError } from '../multiplayer/cloud-api';
import { friendsSchema, type FriendAction } from './contracts';
export function useFriends(username: string) {
  const session = useCloudSession();
  const client = useQueryClient();
  const scope = ['cloud', session.userId ?? '', 'friends'];
  const key = [...scope,username];
  const query = useQuery({ queryKey:key,enabled:Boolean(session.userId),gcTime:0,staleTime:1000,
    refetchOnWindowFocus:'always',refetchOnReconnect:'always',refetchInterval:30000,
    retry:(count,error)=>count<1 && isTransientError(error),
    queryFn:async({signal})=> {
      const value = friendsSchema.safeParse(await cloudJson(`/api/friends${username ? `?username=${encodeURIComponent(username)}` : ''}`,{signal}));
      if (!value.success) throw new ContractError('Friends returned an invalid response.');
      return value.data;
    },
  });
  const mutation = useMutation({retry:false,networkMode:'always',gcTime:0,
    onMutate:async()=>{await client.cancelQueries({queryKey:scope});},
    mutationFn:async(body:FriendAction)=>{
      if (!onlineManager.isOnline()) throw new CloudApiError(0,'OFFLINE','Reconnect before changing your friends.');
      const value = friendsSchema.safeParse(await cloudJson('/api/friends',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
      if (!value.success) throw new ContractError('Refresh your friends to confirm this change.');
      return value.data;
    },
    onSettled:async()=>{await client.invalidateQueries({queryKey:scope});},
  });
  return {...session,...query,change:mutation.mutateAsync,busy:mutation.isPending};
}
