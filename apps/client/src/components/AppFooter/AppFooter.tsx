import styles from './AppFooter.module.css';

export function AppFooter() {
  return (
    <footer className={styles.appFooter}>
      <span className={styles.brand}>LLAAB</span>
      <span className={styles.sep} aria-hidden="true">
        ·
      </span>
      <span className={styles.version}>v0.1.0</span>
    </footer>
  );
}
