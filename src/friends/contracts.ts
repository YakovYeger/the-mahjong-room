import { z } from 'zod';
export const usernameSchema = z.string().trim().transform(value => value.normalize('NFKC').toLowerCase()).pipe(z.string().regex(/^[a-z0-9_]{3,24}$/, 'Use an exact username: 3–24 letters, numbers, or underscores.'));
export const friendActionSchema = z.union([z.object({ username: usernameSchema, operation: z.literal('request') }).strict(), z.object({ username: usernameSchema, operation: z.enum(['accept','decline','cancel','remove']), connectionId: z.uuid() }).strict()]);
export type FriendAction = z.infer<typeof friendActionSchema>;
export const playerSchema = z.object({ username: usernameSchema, displayName: z.string().max(48), memberSince: z.string(), connectionId: z.uuid().nullable(), relationship: z.enum(['self','none','incoming','outgoing','friends']) });
export const friendsSchema = z.object({ self: playerSchema, lookup: playerSchema.nullable(), connections: z.array(playerSchema).max(200) });
export type PlayerProfile = z.infer<typeof playerSchema>;
export type FriendsSnapshot = z.infer<typeof friendsSchema>;
