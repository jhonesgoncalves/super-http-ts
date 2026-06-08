import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { startCatalogGrpcServer } from './catalog/mock/catalog-grpc-server';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Start the mock CatalogService gRPC backend before NestJS boots.
  // In production this would be an external service — remove this block
  // and point CATALOG_GRPC_ADDRESS at your real service address.
  const grpcServer = await startCatalogGrpcServer();

  const app = await NestFactory.create(AppModule);

  // Global validation pipe — rejects malformed request bodies
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Application running on http://localhost:${port}/api`);
  logger.log(`📡 gRPC catalog endpoints:`);
  logger.log(`     GET  http://localhost:${port}/api/catalog`);
  logger.log(`     GET  http://localhost:${port}/api/catalog/search?q=keyboard`);
  logger.log(`     GET  http://localhost:${port}/api/catalog/metrics`);
  logger.log(`     GET  http://localhost:${port}/api/catalog/:id`);
  logger.log(`📊 Health metrics at http://localhost:${port}/api/health/metrics`);

  // Graceful shutdown — close gRPC sessions and mock server
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received — shutting down');
    const { GrpcChannelRegistry } = await import('super-http/grpc');
    await GrpcChannelRegistry.closeAll();
    grpcServer.close(() => process.exit(0));
  });
}

bootstrap();
