import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserMovie } from '../user-movie/user-movie';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  telegramId!: number;

  @OneToMany(() => UserMovie, (UserMovie) => UserMovie.user)
  userMovies!: UserMovie[];
}
