import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { loadLabPublication, publicPilots } from '@/lib/lab/publication';
import { Lab } from '@/components/lab/lab';
import '@/components/lab/lab.css';

export const metadata: Metadata = { title: 'SideFX Lab', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function LabPage() {
  if (process.env.SIDEFX_LAB_ENABLED !== '1') notFound();
  const publication = loadLabPublication();
  return <Lab publicationId={publication.publicationId} pilots={publicPilots(publication)} />;
}
