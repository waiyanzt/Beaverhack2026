declare module "ws" {
  export default class WebSocket {
    readyState: number;

    constructor(url: string);

    close(): void;
    send(data: string): void;
    on(event: "open", listener: () => void): this;
    on(event: "message", listener: (data: string | Buffer | Buffer[]) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "close", listener: () => void): this;
  }
}
