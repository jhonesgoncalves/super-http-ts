import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SuperHttpService } from 'super-http/nestjs';
import { CreateUserDto } from './dto/create-user.dto';

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

/**
 * UsersService — demonstrates the default `SuperHttpService` injection.
 *
 * All requests go through the resilience pipeline configured in AppModule:
 * circuit breaker + exponential-jitter retry + bulkhead isolation.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    // Injecting SuperHttpService (default client registered via forRoot/forRootAsync)
    private readonly http: SuperHttpService,
  ) {}

  async findAll(): Promise<User[]> {
    this.logger.debug('Fetching all users');
    const { data } = await this.http.get<User[]>('/users');
    return data;
  }

  async findOne(id: number): Promise<User> {
    this.logger.debug(`Fetching user #${id}`);
    try {
      const { data } = await this.http.get<User>(`/users/${id}`);
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new NotFoundException(`User #${id} not found`);
      }
      throw err;
    }
  }

  async create(dto: CreateUserDto): Promise<User> {
    this.logger.debug(`Creating user: ${dto.name}`);
    // POST is non-idempotent — use the service's .post() shorthand.
    // Per-request policy (retry: false) is demonstrated in PostsService via
    // the named client's .request() method.
    const { data } = await this.http.post<User>('/users', dto);
    return data;
  }

  async update(id: number, dto: Partial<CreateUserDto>): Promise<User> {
    this.logger.debug(`Updating user #${id}`);
    const { data } = await this.http.put<User>(`/users/${id}`, dto);
    return data;
  }

  async remove(id: number): Promise<void> {
    this.logger.debug(`Removing user #${id}`);
    await this.http.delete(`/users/${id}`);
  }
}
