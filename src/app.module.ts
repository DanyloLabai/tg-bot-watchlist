import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramBotModule } from './telegram-bot/telegram-bot.module';
import { MoviesModule } from './movies/movies.module';
import { Movie } from './movies/entities/movie/movie';
import { UserMovie } from './movies/entities/user-movie/user-movie';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [Movie, UserMovie],
      autoLoadEntities: true,
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Movie, UserMovie]),
    TelegramBotModule,
    MoviesModule,
  ],
})
export class AppModule {}
