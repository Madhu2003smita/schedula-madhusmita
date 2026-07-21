import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

export type UserRole = 'DOCTOR' | 'PATIENT';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly users: StoredUser[] = [];

  constructor(private readonly jwtService: JwtService) {}

  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase();
    const existingUser = this.users.find((user) => user.email === email);

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const user: StoredUser = {
      id: randomUUID(),
      email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      role: dto.role,
    };

    this.users.push(user);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: this.toPublicUser(user),
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = this.users.find((item) => item.email === email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: this.toPublicUser(user),
    };
  }

  async validateUser(payload: { sub: string; email: string; role: UserRole }) {
    const user = this.users.find((item) => item.id === payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toPublicUser(user);
  }

  private toPublicUser(user: StoredUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
