import { notFound } from 'next/navigation';
import CoachPreview from './coach-preview';
export default function CoachPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <CoachPreview />;
}
