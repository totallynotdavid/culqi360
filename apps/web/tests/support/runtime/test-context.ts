declare module "vitest" {
  interface ProvidedContext {
    testWebDbUrl: string;
  }
}

export const TEST_WEB_DB_URL_CONTEXT = "testWebDbUrl";
