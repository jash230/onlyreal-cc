import { Navigate, useParams } from 'react-router-dom';

// Placeholder copy: have counsel replace these before launch.
const DOCS = {
  terms: {
    title: 'Terms of Service',
    body: [
      'OnlyReal is only for adults. You must be at least 18 years old, or the age of majority where you live if that is higher, to create an account or view content.',
      'You are responsible for everything you upload. You may only post content that you own or have the rights to, in which every person depicted is an adult who consented to being recorded and to publication.',
      'We may remove content or suspend accounts that violate these terms or our Community Guidelines, and we report child sexual abuse material to NCMEC and law enforcement.',
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    body: [
      'Zero tolerance for minors. Any content depicting, or appearing to depict, a person under 18 is removed and reported.',
      'Consent is required. No hidden-camera, leaked, “revenge”, coerced, or otherwise non-consensual content. No deepfakes or sexualized content of real people without their consent.',
      'No illegal content, including violence, bestiality, incest, or content involving intoxicated or incapacitated people.',
      'No spam, scams, impersonation, or off-platform solicitation of illegal services.',
      'Use the Report button on any clip. Reports of minors or non-consensual content hide the clip immediately while we review.',
    ],
  },
  2257: {
    title: '18 U.S.C. 2257 Compliance',
    body: [
      'All persons depicted in content on OnlyReal were at least 18 years old at the time of creation. Creators attest to this, and to the consent of everyone depicted, on every upload.',
      'Records required under 18 U.S.C. §2257 for content produced by creators are maintained by the respective creators/producers. Custodian of records contact details: [add before launch].',
    ],
  },
};

export default function Legal() {
  const { doc } = useParams();
  const page = DOCS[doc];
  if (!page) return <Navigate to="/" replace />;
  return (
    <div className="page legal">
      <h1>{page.title}</h1>
      {page.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
