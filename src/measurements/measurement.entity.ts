import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'measurements' })
@Index(['userId', 'timestamp'])
export class Measurement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  eventId!: string;

  @Column({ type: 'varchar', length: 100 })
  userId!: string;

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @Column({ type: 'smallint' })
  heartRate!: number;

  @Column({ type: 'double precision', nullable: true })
  hrv!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
