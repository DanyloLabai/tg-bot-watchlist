import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserMovie } from '../user-movie/user-movie';

@Entity()
export class Movie {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ nullable: true })
  yeaк?: string;

  @Column({ type: 'float', nullable: true })
  imdbRating?: number;

  @Column({ nullable: true })
  poster?: string;

  @OneToMany(() => UserMovie, (UserMovie) => UserMovie.movie)
  userMovies!: UserMovie[];
}
