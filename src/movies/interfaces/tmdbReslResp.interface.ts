export interface TMDBMovieResult {
  title: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
}

export interface TMDBTvResult {
  name: string;
  first_air_date: string;
  vote_average: number;
  poster_path: string | null;
}

export type TMDBSearchResult = TMDBMovieResult | TMDBTvResult;

export interface TMDBResponse {
  results: TMDBSearchResult[];
}

export interface SearchResult {
  title: string;
  year: string;
  imdbRating: number;
  poster: string | null;
}
