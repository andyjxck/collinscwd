import { SiteShell } from "../../components/SiteShell";
import { site } from "../../content/site";
import styles from "../marketing.module.css";

export default function TestimonialsPage() {
  return (
    <SiteShell>
      <div className={styles.section} style={{ marginTop: 0 }}>
        <div className={styles.sectionTitle}>Testimonials</div>
        <div className={styles.sectionLead}>
          Feedback from clients across Redditch and the surrounding area.
        </div>
        <div className={styles.list}>
          {site.testimonials.map((t, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.cardBody} style={{ fontSize: 15 }}>
                “{t.quote}”
              </div>
              <div style={{ height: 10 }} />
              <div className={styles.rowMeta}>
                {t.name} — {t.location}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
