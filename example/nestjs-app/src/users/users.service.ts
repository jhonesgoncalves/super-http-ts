import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SuperHttpService } from 'super-http/nestjs';
import type { HttpClient } from 'super-http';
import type { CreateUserDto } from './dto/create-user.dto';

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

    // Non-idempotent — disable retry for this request via per-request policy
    const client = this.http.instance as HttpClient;
    const { data } = await client.post<User>('/users', dto, {
      policy: { retry: false, timeout: 10_000 },
    });
    return data;
  }

  async update(id: number, dto: Partial<CreateUserDto>): Promise<User> {
    this.logger.debug(`Updating user #${id}`);
    const client = this.http.instance as HttpClient;
    const { data } = await client.put<User>(`/users/${id}`, dto);
    return data;
  }

  async remove(id: number): Promise<void> {
    this.logger.debug(`Removing user #${id}`);
    const client = this.http.instance as HttpClient;
    await client.delete(`/users/${id}`, {
      policy: { retry: false }, // DELETE is non-idempotent — no retry
    });
  }
}
