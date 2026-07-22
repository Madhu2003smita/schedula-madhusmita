import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('signs up a doctor and returns a JWT', async () => {
    const result = await service.signup({
      email: 'doctor@example.com',
      password: 'secret123',
      role: 'DOCTOR',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.user.role).toBe('DOCTOR');
  });

  it('logs in an existing user with the correct credentials', async () => {
    await service.signup({
      email: 'patient@example.com',
      password: 'secret123',
      role: 'PATIENT',
    });

    const result = await service.login({
      email: 'patient@example.com',
      password: 'secret123',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.user.role).toBe('PATIENT');
  });
});
