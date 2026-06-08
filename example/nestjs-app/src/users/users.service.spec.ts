import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { SuperHttpService } from 'super-http/nestjs';

// ─── Mock ─────────────────────────────────────────────────────────────────────

const mockSuperHttpService = {
  get:      jest.fn(),
  post:     jest.fn(),
  put:      jest.fn(),
  delete:   jest.fn(),
  metrics:  jest.fn(),
  instance: {
    post:   jest.fn(),
    put:    jest.fn(),
    delete: jest.fn(),
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SuperHttpService, useValue: mockSuperHttpService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all users from the API', async () => {
      const users = [
        { id: 1, name: 'Alice', email: 'alice@example.com', username: 'alice' },
        { id: 2, name: 'Bob',   email: 'bob@example.com',   username: 'bob'   },
      ];
      mockSuperHttpService.get.mockResolvedValue({ data: users });

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(mockSuperHttpService.get).toHaveBeenCalledWith('/users');
    });

    it('propagates errors from the HTTP client', async () => {
      mockSuperHttpService.get.mockRejectedValue(new Error('Network error'));
      await expect(service.findAll()).rejects.toThrow('Network error');
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a single user by id', async () => {
      const user = { id: 1, name: 'Alice', email: 'alice@example.com', username: 'alice' };
      mockSuperHttpService.get.mockResolvedValue({ data: user });

      const result = await service.findOne(1);

      expect(result).toEqual(user);
      expect(mockSuperHttpService.get).toHaveBeenCalledWith('/users/1');
    });

    it('throws NotFoundException when API returns 404', async () => {
      mockSuperHttpService.get.mockRejectedValue({ response: { status: 404 } });
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('re-throws non-404 errors', async () => {
      mockSuperHttpService.get.mockRejectedValue(new Error('timeout'));
      await expect(service.findOne(1)).rejects.toThrow('timeout');
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a user and returns the new record', async () => {
      const dto = { name: 'Carol', email: 'carol@example.com' };
      const created = { id: 11, username: 'carol', ...dto };
      mockSuperHttpService.instance.post.mockResolvedValue({ data: created });

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockSuperHttpService.instance.post).toHaveBeenCalledWith(
        '/users',
        dto,
        expect.objectContaining({ policy: { retry: false, timeout: 10_000 } }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a user and returns the updated record', async () => {
      const dto = { name: 'Alice Updated' };
      const updated = { id: 1, name: 'Alice Updated', email: 'alice@example.com', username: 'alice' };
      mockSuperHttpService.instance.put.mockResolvedValue({ data: updated });

      const result = await service.update(1, dto);

      expect(result).toEqual(updated);
      expect(mockSuperHttpService.instance.put).toHaveBeenCalledWith('/users/1', dto);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes a user without returning data', async () => {
      mockSuperHttpService.instance.delete.mockResolvedValue({ data: {} });

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(mockSuperHttpService.instance.delete).toHaveBeenCalledWith(
        '/users/1',
        expect.objectContaining({ policy: { retry: false } }),
      );
    });
  });
});
