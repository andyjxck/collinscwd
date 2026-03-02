import { SiteShell } from "../../components/SiteShell";
import { site } from "../../content/site";
import styles from "../marketing.module.css";

export default function PortfolioPage() {
  return (
    <SiteShell>
      <div className={styles.section} style={{ marginTop: 0 }}>
        <div className={styles.sectionTitle}>Portfolio</div>
        <div className={styles.sectionLead}>{site.portfolio.intro}</div>
        <div className={styles.list}>
          {site.portfolio.projects.map((p) => (
            <div key={p.title} className={styles.card}>
              <div className={styles.row}>
                <div className={styles.cardTitle}>{p.title}</div>
                <div className={styles.rowMeta}>{p.location}</div>
              </div>
              <div className={styles.cardBody}>{p.summary}</div>
            </div>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
