import Link from "next/link";

import { SiteShell } from "../../components/SiteShell";
import { site } from "../../content/site";
import styles from "../marketing.module.css";

export default function ContactPage() {
  return (
    <SiteShell>
      <div className={styles.section} style={{ marginTop: 0 }}>
        <div className={styles.sectionTitle}>{site.contact.headline}</div>
        <div className={styles.sectionLead}>{site.contact.subheadline}</div>

        <div style={{ height: 18 }} />
        <div className={styles.card}>
          <div className={styles.cardTitle}>Contact details</div>
          <div className={styles.cardBody}>
            {site.phone ? <div>Phone: {site.phone}</div> : <div>Phone: (set in content/site.ts)</div>}
            {site.email ? <div>Email: {site.email}</div> : <div>Email: (set in content/site.ts)</div>}
            {site.contact.address ? <div>Address: {site.contact.address}</div> : null}
            <div style={{ height: 12 }} />
            <div>
              For now, quote requests can be handled by email/phone. Next we’ll wire a quote request form into Supabase.
            </div>
            <div style={{ height: 12 }} />
            <Link href="/" className={styles.rowMeta}>
              Return to home
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
