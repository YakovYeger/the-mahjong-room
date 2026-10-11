import { notFound } from 'next/navigation';
import TableConcept from './table-concept';

export default function TableConceptPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <TableConcept />;
}
