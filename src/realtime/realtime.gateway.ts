import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Measurement } from '../measurements/measurement.entity';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RealtimeGateway {
  @WebSocketServer()
  private server!: Server;

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { userId?: string },
  ): Promise<{ subscribed: true; userId: string }> {
    const userId = body?.userId?.trim();
    if (!userId) {
      throw new WsException('userId is required');
    }
    await client.join(`user:${userId}`);
    return { subscribed: true, userId };
  }

  publishMeasurement(measurement: Measurement): void {
    this.server.to(`user:${measurement.userId}`).emit('measurement', measurement);
  }
}
