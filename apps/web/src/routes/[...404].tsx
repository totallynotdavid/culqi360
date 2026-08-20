import { AnimatedPlaceholder } from "~/components/layout/animated-placeholder";
import { Button } from "~/components/ui/input/button";

import styles from "./[...404].module.css";

export default function NotFound() {
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
