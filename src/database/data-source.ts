// import 'reflect-metadata';
// import { DataSource } from 'typeorm';
// import * as dotenv from 'dotenv';

// dotenv.config();

// export const AppDataSource = new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST ?? 'localhost',
//   port: Number(process.env.DB_PORT) || 5432,
//   username: process.env.DB_USERNAME ?? 'postgres',
//   password: process.env.DB_PASSWORD ?? 'madhu1928',
//   database: process.env.DB_NAME ?? 'schedula',
//   entities: [__dirname + '/../**/*.entity{.ts,.js}'],
//   migrations: [__dirname + '/../migrations/*{.ts,.js}'],
//   synchronize: false,
//   logging: false,
// });




import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});