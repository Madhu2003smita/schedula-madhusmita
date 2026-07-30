import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    // TypeOrmModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     type: 'postgres',
    //     host: config.get<string>('DB_HOST', 'localhost'),
    //     port: config.get<number>('DB_PORT', 5432),
    //     username: config.get<string>('DB_USERNAME', 'postgres'),
    //     password: config.get<string>('DB_PASSWORD', 'madhu1928'),
    //     database: config.get<string>('DB_NAME', 'schedula'),
    //     entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    //     migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    //     synchronize: false,
    //     logging: false,
    //   }),
    // }),




    TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get<string>('DATABASE_URL'),
    ssl: {
      rejectUnauthorized: false,
    },
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: false,
    logging: false,
  }),
}),
  ],
})
export class DatabaseModule {}
