declare module 'embedded-postgres' {
  export interface EmbeddedPostgresOptions {
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    persistent?: boolean;
    databaseDir?: string;
    dataDir?: string;
  }

  export default class EmbeddedPostgres {
    constructor(options?: EmbeddedPostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
  }
}
