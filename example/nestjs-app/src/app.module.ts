import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SuperHttpModule } from 'super-http/nestjs';
import { SuperHttpConfigService } from './config/super-http.config';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    // Make process.env available via ConfigService throughout the app
    ConfigModule.forRoot({ isGlobal: true }),

    /**
     * Register the default SuperHttpService globally via forRootAsync.
     *
     * SuperHttpConfigService implements SuperHttpOptionsFactory and builds the
     * options from environment variables via ConfigService.
     *
     * `imports` is forwarded to the dynamic module context so that ConfigModule
     * (and therefore ConfigService) is available when NestJS instantiates
     * SuperHttpConfigService via `useClass`.
     */
    SuperHttpModule.forRootAsync({
      imports:  [ConfigModule],
      useClass: SuperHttpConfigService,
    }),

    UsersModule,
    PostsModule,
    HealthModule,
    CatalogModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
