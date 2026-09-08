import { Hero, PrimaryLink, SecondaryLink, Section } from '@/components/ui';
import { CTA, ROUTES } from '@/lib/routes';

/** §7 — an unknown public identity returns 404 without revealing whether a private one exists. */
export default function NotFound() {
  return (
    <>
      <Hero
        eyebrow="404"
        title="That page does not exist."
        subhead="The address may have changed, or the identity may never have been published."
        actions={
          <>
            <PrimaryLink href={CTA.explore.href}>{CTA.explore.label}</PrimaryLink>
            <SecondaryLink href={ROUTES.home.href}>Back to the homepage</SecondaryLink>
          </>
        }
      />
      <Section>
        <p className="max-w-2xl text-sm text-muted">
          Public capability, mechanic and provider pages come from the published estate generation. An
          identity that is not in that publication returns this page.
        </p>
      </Section>
    </>
  );
}
