import { notFound } from 'next/navigation';
import TablePreview from './table-preview';

export default function TablePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <TablePreview />;
}
