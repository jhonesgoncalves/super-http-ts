import { Module } from '@nestjs/common';
import { SuperHttpModule } from 'super-http/nestjs';
import { SuperHttpConfigService } from './config/super-http.config';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    /**
     * Register the default SuperHttpService globally via forRootAsync.
     *
     * SuperHttpConfigService implements SuperHttpOptionsFactory and builds the
     * options from the environment — it is injected as `useClass`.
     *
     * Because SuperHttpModule is @Global(), the default SuperHttpService is
     * available throughout the application without needing to re-import this
     * module in every feature module.
     */
    SuperHttpModule.forRootAsync({
      useClass: SuperHttpConfigService,
    }),

    UsersModule,
    PostsModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
