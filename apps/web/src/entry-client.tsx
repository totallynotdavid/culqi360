import { hydrate } from "@solidjs/web";

import "./browser/bootstrap";
import Root from "./Root";

hydrate(() => <Root />, document);
