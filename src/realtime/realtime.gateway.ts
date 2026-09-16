import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MAX_ID_LENGTH } from '../measurements/dto/create-measurement.dto';
import { Measurement } from '../measurements/measurement.entity';

/** Event name clients listen on for new measurements. */
export const MEASUREMENT_EVENT = 'measurement';

/** Socket.IO room that carries realtime events for exactly one user. */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

interface SubscriptionRequest {
  userId?: unknown;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private server!: Server;

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscriptionRequest,
  ) {
    const userId = this.parseUserId(body);
    await client.join(userRoom(userId));
    this.logger.debug(`Client ${client.id} subscribed to user ${userId}`);
    return { subscribed: true, userId };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscriptionRequest,
  ) {
    const userId = this.parseUserId(body);
    await client.leave(userRoom(userId));
    this.logger.debug(`Client ${client.id} unsubscribed from user ${userId}`);
    return { subscribed: false, userId };
  }

  publishMeasurement(measurement: Measurement): void {
    if (!this.server) {
      this.logger.warn(
        `WebSocket server not initialised; dropping realtime event for measurement ${measurement.id}`,
      );
      return;
    }

    // Emit to this user's room only. Sockets that never subscribed to this
    // user, or subscribed to a different one, are not in the room and never
    // receive the payload.
    this.server
      .to(userRoom(measurement.userId))
      .emit(MEASUREMENT_EVENT, measurement);
  }

  /**
   * Validates the subscription payload. Errors are raised as WsException so
   * Nest reports them to the calling socket on its `exception` event instead
   * of crashing the handler.
   */
  private parseUserId(body: SubscriptionRequest | undefined): string {
    const raw = body?.userId;
    if (typeof raw !== 'string') {
      throw new WsException('userId must be a string');
    }

    const userId = raw.trim();
    if (!userId) {
      throw new WsException('userId is required');
    }
    if (userId.length > MAX_ID_LENGTH) {
      throw new WsException(
        `userId must be at most ${MAX_ID_LENGTH} characters`,
      );
    }

    return userId;
  }
}
