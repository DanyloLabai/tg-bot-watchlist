import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramBotService implements OnModuleInit {
    private bot?: Telegraf;

    constructor(private configService: ConfigService) {}

    onModuleInit() {
        const token = this.configService.get<string>('BOT_TOKEN');
        if(!token) {
            throw new Error('BOT_TOKEN not defined in env')
        }
        this.bot = new Telegraf(token);

        this.bot.start((ctx) => {
            ctx.reply('Hello! Send a movie title,to add to watchlist');
        });

        this.bot.launch();
        console.log('Bot start');
    }
}
