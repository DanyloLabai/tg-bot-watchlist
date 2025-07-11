import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Movie } from '../movie/movie';
import { User } from '../user/user.entity';

@Entity()
export class UserMovie {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @ManyToOne(() => User, (user) => user.userMovies, { cascade: true })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  movieId!: number;

  @ManyToOne(() => Movie, (movie) => movie.userMovies, { cascade: true })
  @JoinColumn({ name: 'movieId' })
  movie!: Movie;
}
