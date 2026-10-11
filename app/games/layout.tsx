import type { ReactNode } from 'react';
import { CloudQueryProvider } from '../../src/multiplayer/cloud-query-provider';

export default function GamesLayout({ children }: { children: ReactNode }) {
  return <CloudQueryProvider>{children}</CloudQueryProvider>;
}
