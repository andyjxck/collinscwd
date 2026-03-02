import Link from "next/link";
import React from "react";

import { site } from "../content/site";
import styles from "./SiteShell.module.css";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.brandName}>{site.businessName}</div>
            <div className={styles.brandMeta}>{site.location}</div>
          </div>
          <nav className={styles.nav}>
            {site.navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className={styles.cta} href="/contact">
              {site.primaryCtaLabel}
            </Link>
          </nav>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            {new Date().getFullYear()} {site.businessName}
          </div>
          <div>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
