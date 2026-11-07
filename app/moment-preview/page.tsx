import { notFound } from 'next/navigation';
import MomentPreview from './preview';
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MomentPreview />;
}
