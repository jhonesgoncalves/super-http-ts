import { Injectable, Logger } from '@nestjs/common';
import { InjectSuperHttp } from 'super-http/nestjs';
import type { HttpClient } from 'super-http';

export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}

/**
 * PostsService — demonstrates `@InjectSuperHttp('POSTS')` named client injection.
 *
 * The POSTS client is registered via `SuperHttpModule.forFeature` in PostsModule
 * with the `high-throughput` preset — optimised for read-heavy workloads.
 *
 * The COMMENTS client uses the `low-latency` preset with a fallback so that
 * a comment-service failure never breaks the posts endpoint.
 */
@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectSuperHttp('POSTS')    private readonly postsClient: HttpClient,
    @InjectSuperHttp('COMMENTS') private readonly commentsClient: HttpClient,
  ) {}

  async findAll(): Promise<Post[]> {
    const { data } = await this.postsClient.get<Post[]>('/posts');
    return data;
  }

  async findOne(id: number): Promise<Post> {
    const { data } = await this.postsClient.get<Post>(`/posts/${id}`);
    return data;
  }

  /**
   * Fetches a post with its comments.
   * Comments use a fallback — if the comments service is down, the post
   * is returned with an empty array instead of failing the whole request.
   */
  async findWithComments(postId: number): Promise<Post & { comments: Comment[] }> {
    const [postRes, commentsRes] = await Promise.all([
      this.postsClient.get<Post>(`/posts/${postId}`),
      this.commentsClient.get<Comment[]>(`/posts/${postId}/comments`),
    ]);

    return { ...postRes.data, comments: commentsRes.data };
  }

  async create(dto: Omit<Post, 'id'>): Promise<Post> {
    // Non-idempotent — disable retry via per-request policy
    const { data } = await this.postsClient.request<Post>({
      method: 'POST',
      url: '/posts',
      data: dto,
      policy: { retry: false },
    });
    return data;
  }
}
