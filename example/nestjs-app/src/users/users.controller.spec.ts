import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// ─── Mock ─────────────────────────────────────────────────────────────────────

const mockUsersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  remove:  jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users', () => {
    it('calls usersService.findAll and returns the result', async () => {
      const users = [{ id: 1, name: 'Alice' }];
      mockUsersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(result).toEqual(users);
      expect(mockUsersService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /users/:id', () => {
    it('returns a user by id', async () => {
      const user = { id: 1, name: 'Alice' };
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await controller.findOne(1);

      expect(result).toEqual(user);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
    });

    it('propagates NotFoundException from service', async () => {
      mockUsersService.findOne.mockRejectedValue(new NotFoundException('User #999 not found'));
      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /users', () => {
    it('creates and returns a new user', async () => {
      const dto = { name: 'Bob', email: 'bob@example.com' };
      const created = { id: 11, ...dto, username: 'bob' };
      mockUsersService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(result).toEqual(created);
      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('PUT /users/:id', () => {
    it('updates and returns the user', async () => {
      const dto = { name: 'Bob Updated' };
      const updated = { id: 1, name: 'Bob Updated', email: 'bob@example.com', username: 'bob' };
      mockUsersService.update.mockResolvedValue(updated);

      const result = await controller.update(1, dto);

      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /users/:id', () => {
    it('calls remove and returns void', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);
      await expect(controller.remove(1)).resolves.toBeUndefined();
      expect(mockUsersService.remove).toHaveBeenCalledWith(1);
    });
  });
});
