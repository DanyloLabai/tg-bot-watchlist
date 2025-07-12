import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup, Telegraf } from 'telegraf';
import { MovieSearchService } from 'src/movies/movie-search/movie-search.service';
import { MoviesService } from 'src/movies/movies.service';
@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot?: Telegraf;

  constructor(
    private configService: ConfigService,
    private moviesSearchService: MovieSearchService,
    private moviesService: MoviesService,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) {
      throw new Error('BOT_TOKEN not defined in env');
    }
    this.bot = new Telegraf(token);
    this.bot.start((ctx) => {
      ctx.reply('Hello! Send a movie title,to add to watchlist');
    });

    this.bot.on('text', async (ctx) => {
      const title = ctx.message.text;
      const movie = await this.moviesSearchService.searchByTitle(title);

      if (!movie) {
        return ctx.reply('Movie not found');
      }

      const caption = ` *${movie.title}* (${movie.year})\n IMDb: ${movie.imdbRating?.toFixed(1) ?? "N/A"}`;

      const buttons = Markup.inlineKeyboard([
        Markup.button.callback('Add to watchlist', `add_${movie.title}`),
        Markup.button.callback('Next', 'next'),
      ]);
      if (movie.poster) {
        return ctx.replyWithPhoto(movie.poster, {
          caption,
          parse_mode: 'Markdown',
          ...buttons,
        });
      } else {
        return ctx.reply(caption, { parse_mode: 'Markdown', ...buttons });
      }
    });
    this.bot.action(/add_(.+)/, async (ctx) => {
      const movieTitle = ctx.match[1];
      const userId = ctx.from.id;

      let movie = await this.moviesService.findByTitle(movieTitle);

      if (!movie) {
        const movieData = await this.moviesSearchService.searchByTitle(movieTitle);
        if (!movieData) {
          return ctx.answerCbQuery('Movie not found', { show_alert: true });
        }

        const cleanedData = {
          ...movieData,
          poster: movieData.poster ?? undefined,
        };
        movie = await this.moviesService.create(cleanedData);
      }

      const result = await this.moviesService.addToWatchlist(userId, movie);

      if (!result.added) {
        await ctx.answerCbQuery('This movie is already in your watchlist!');
      } else {
        await ctx.answerCbQuery('Movie add to watchlist!');
      }
      await ctx.editMessageReplyMarkup(undefined);
    });

    this.bot.action('next', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      await ctx.reply('Enter movies title.');
    });

    this.bot.launch();
    console.log('Bot start');
  }
}
