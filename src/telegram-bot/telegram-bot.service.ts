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

  private readonly userState = new Map<number, 'idle' | 'awaiting_search'>();

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
      const userId = ctx.from.id;
      const state = this.userState.get(userId);

      if (state !== 'awaiting_search') {
        return ctx.reply(
          'What would you like to do?',
          Markup.inlineKeyboard([
            [Markup.button.callback(' Search movie', 'next')],
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
          ]),
        );
      }

      this.userState.set(userId, 'idle'); 

      const input = ctx.message.text.trim();
      const match = input.match(/^(.*?)(?:\s+(\d{4}))?$/);
      const title = match?.[1]?.trim() ?? '';
      const year = match?.[2] ? parseInt(match[2]) : undefined;

      const movie = await this.moviesSearchService.searchByTitle(title, year);

      if (!movie) {
        return ctx.reply('Movie not found', Markup.inlineKeyboard([
            [Markup.button.callback(' Search movie', 'next')],
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
          ]),
        );
      }

      const caption = `*${movie.title}* (${movie.year})\nIMDb: ${movie.imdbRating?.toFixed(1) ?? 'N/A'}`;
      const buttons = Markup.inlineKeyboard([
        Markup.button.callback(
          'Add to watchlist',
          `add_${encodeURIComponent(movie.title)}_${movie.year}`,
        ),
        Markup.button.callback('Search movie', 'next'),
        Markup.button.callback('View watchlist', 'show_watchlist'),
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

    this.bot.action(/add_(.+)_(\d{4})/, async (ctx) => {
      const title = decodeURIComponent(ctx.match[1]);
      const year = ctx.match[2];
      const userId = ctx.from.id;

      let movie = await this.moviesService.findByTitle(title, year);
      if (!movie) {
        const movieData = await this.moviesSearchService.searchByTitle(title, parseInt(year));
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
        await ctx.answerCbQuery('Movie already in your watchlist!');
      } else {
        await ctx.answerCbQuery('Movie added!');
      }

      await ctx.editMessageReplyMarkup(undefined);

      await ctx.reply(
        'What would you like to do next?',
        Markup.inlineKeyboard([
          [Markup.button.callback('View watchlist', 'show_watchlist')],
          [Markup.button.callback('Search movie', 'next')],
        ]),
      );
    });

    this.bot.action('show_watchlist', async (ctx) => {
      await ctx.answerCbQuery();

      const userId = ctx.from.id;
      const watchlist = await this.moviesService.getUserWatchlist(userId);

      if (watchlist.length === 0) {
        return ctx.reply(' Your watchlist is empty', Markup.inlineKeyboard([
            [Markup.button.callback(' Search movie', 'next')],
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
          ]),
        );
      }

      let message = '* Your Watchlist:*\n\n';
      message += watchlist.map((m, i) => `${i + 1}. ${m.title} (${m.year})`).join('\n');

      await ctx.reply(message, { parse_mode: 'Markdown' });

      await ctx.reply(
        'What next?',
        Markup.inlineKeyboard([
          [Markup.button.callback(' Search movie', 'next')],
          [Markup.button.callback(' Check movie', 'check_watchlist')],
        ]),
      );
    });

    this.bot.action('check_watchlist', async (ctx) => {
      await ctx.answerCbQuery();

      const userId = ctx.from.id;
      const watchlist = await this.moviesService.getUserWatchlist(userId);

      if (watchlist.length === 0) {
        return ctx.reply(' Your watchlist is empty.', Markup.inlineKeyboard([
            [Markup.button.callback(' Search movie', 'next')],
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
          ]),
        );
      }

      const movieButtons = watchlist.map(movie => [
        Markup.button.callback(movie.title, `show_${movie.title}`),
      ]);

      movieButtons.push([
        Markup.button.callback(' Search movie', 'next'),
        Markup.button.callback(' View watchlist', 'show_watchlist'),
      ]);

      await ctx.reply(' *Choose a movie:*', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(movieButtons),
      });
    });

    this.bot.action(/show_(.+)/, async (ctx) => {
      const movieTitle = ctx.match[1];
      const movie = await this.moviesService.findByTitle(movieTitle);

      if (!movie) {
        return ctx.reply(' Movie not found.');
      }

      const caption = `*${movie.title}* (${movie.year})\nIMDb: ${movie.imdbRating ?? 'N/A'}`;

      const buttons = Markup.inlineKeyboard([
        [Markup.button.callback(' Remove', `remove_${movie.title}`)],
        // [Markup.button.callback(' Cast', `cast_${movie.id}`)],
        // [Markup.button.callback(' Description', `desc_${movie.id}`)],
        [Markup.button.callback(' Search movie', 'next')],
        [Markup.button.callback(' View watchlist', 'show_watchlist')],
      ]);

      if (movie.poster) {
        await ctx.replyWithPhoto(movie.poster, {
          caption,
          parse_mode: 'Markdown',
          ...buttons,
        });
      } else {
        await ctx.reply(caption, {
          parse_mode: 'Markdown',
          ...buttons,
        });
      }
    });
    // Cast and description
    // this.bot.action(/cast_(\d+)/, async (ctx) => {
    //   const movieId = parseInt(ctx.match[1]);
    //   const cast = await this.moviesService.getMovieCast(movieId);

    //   if (!cast.length) {
    //     return ctx.reply('No cast info available.');
    //   }

    //   const castList = cast.join(', ');
    //   await ctx.reply(`*Cast:*\n${castList}`, { parse_mode: 'Markdown' });
    // });

    // this.bot.action(/desc_(\d+)/, async (ctx) => {
    //   const movieId = parseInt(ctx.match[1]);
    //   const overview = await this.moviesService.getMovieOverview(movieId);

    //   await ctx.reply(`*Description:*\n${overview}`, { parse_mode: 'Markdown' });
    // });

    this.bot.action(/remove_(.+)/, async (ctx) => {
      const title = ctx.match[1];
      const userId = ctx.from.id;

      const removed = await this.moviesService.deleteFromWatchlist(userId, title);

      if (removed) {
        await ctx.answerCbQuery(` Removed "${title}" from your watchlist.`);

        await ctx.reply(
          'What would you like to do next?',
          Markup.inlineKeyboard([
            [Markup.button.callback(' View watchlist', 'show_watchlist')],
            [Markup.button.callback(' Search movie', 'next')],
          ]),
        );
      } else {
        await ctx.answerCbQuery(` Movie not found in your watchlist.`);
      }

      await ctx.editMessageReplyMarkup(undefined);
    });

    this.bot.action('next', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);

      this.userState.set(ctx.from.id, 'awaiting_search');

      await ctx.reply('Enter movie title:');
    });

    this.bot.launch();
    console.log('Bot start');
  }
}
