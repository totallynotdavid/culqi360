import { Button } from "~/components/ui/input/button";

import { AnimatedPlaceholder } from "./animated-placeholder";

import styles from "./not-found-page.module.css";

export function NotFoundPage() {
  return (
    <div class={styles.backdrop}>
      <div class={styles.container}>
        <AnimatedPlaceholder type="error404" />
        <div class={styles.textContainer}>
          <p class={styles.title}>Me parece que te has perdido</p>
          <p class={styles.subtitle}>
            Esta página ya no existe o fue movida. Puedes contactar al equipo de
            TI o volver al inicio.
          </p>
        </div>
        <div class={styles.buttonWrap}>
          <a href="/" style={{ "text-decoration": "none", display: "block" }}>
            <Button variant="primary" style={{ width: "100%" }}>
              Regresar al inicio
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
