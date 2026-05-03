export interface VtsConnectionConfig {
  host: string;
  port: number;
  pluginName: string;
  pluginDeveloper: string;
}

export interface AppConfig {
  vts: VtsConnectionConfig;
}
