import {
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { subscribeProgress } from "@meshforge/queue";
import type { ProgressEvent } from "@meshforge/shared-types";

// Repassa eventos de progresso (Redis pub/sub) para os clientes via socket.io.
// Cada cliente entra na sala da geração que quer acompanhar.
@WebSocketGateway({ cors: { origin: "*" } })
export class ProgressGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;

  afterInit(): void {
    subscribeProgress((ev: ProgressEvent) => {
      this.server.to(ev.generationId).emit("progress", ev);
    });
  }

  handleConnection(): void {
    /* nada por enquanto */
  }

  // Cliente envia { generationId } para acompanhar uma geração.
  @SubscribeMessage("subscribe")
  onSubscribe(client: Socket, payload: { generationId: string }): { ok: boolean } {
    if (payload?.generationId) client.join(payload.generationId);
    return { ok: true };
  }
}
