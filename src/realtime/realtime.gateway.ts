import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
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
  ) {
    // TODO(candidate): validate the requested userId and join a user-specific room.
    // Return a small acknowledgement object so the caller can tell subscription worked.
    throw new Error('Not implemented');
  }

  publishMeasurement(measurement: Measurement): void {
    // TODO(candidate): emit only to clients subscribed to this measurement's user.
    throw new Error('Not implemented');
  }
}
