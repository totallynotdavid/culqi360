import styles from "./loader.module.css";

export function Loader() {
  return (
    <div class={styles.container}>
      <div class={styles.dot} />
    </div>
  );
}
