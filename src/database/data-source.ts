import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Measurement } from '../measurements/measurement.entity';
import { InitialSchema1726500000000 } from './migrations/1726500000000-InitialSchema';

export default new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgres://interview:interview@localhost:5432/interview',
  entities: [Measurement],
  migrations: [InitialSchema1726500000000],
  synchronize: false,
});
