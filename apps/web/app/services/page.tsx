import { SiteShell } from "../../components/SiteShell";
import { site } from "../../content/site";
import styles from "../marketing.module.css";

export default function ServicesPage() {
  return (
    <SiteShell>
      <div className={styles.section} style={{ marginTop: 0 }}>
        <div className={styles.sectionTitle}>Services</div>
        <div className={styles.sectionLead}>
          Conservatories, windows and doors — delivered with a structured process and clear documentation.
        </div>
        <div className={styles.grid3}>
          {site.services.map((s) => (
            <div key={s.title} className={styles.card}>
              <div className={styles.cardTitle}>{s.title}</div>
              <div className={styles.cardBody}>{s.description}</div>
            </div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
