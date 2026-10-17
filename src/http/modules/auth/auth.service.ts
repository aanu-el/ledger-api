import bcrypt from "bcryptjs";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import jwt from "jsonwebtoken";
import { problems } from "../../problem.js";

const BCRYPT_ROUNDS = 12;

type SignupInput = {
  name: string;
  email: string;
  password: string;
};

type Tenant = {
  id: string;
  name: string;
  email: string;
};

export class AuthService {
  constructor(private readonly deps: { db: PrismaClient; jwtSecret: string }) {}

  async signup(data: SignupInput) {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    try {
      const tenant = await this.deps.db.tenant.create({
        data: {
          name: data.name,
          email: data.email,
          password: hashedPassword,
        },
      });
      const accessToken = this.createSession(tenant);

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
        },
        accessToken,
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw problems.conflict("An account with this email already exists.");
      }
      throw error;
    }
  }

  async signin(email: string, password: string) {
    const tenant = await this.deps.db.tenant.findUnique({
      where: { email },
    });

    if (!tenant) {
      throw problems.unauthorized("Invalid email or password.");
    }

    const isPasswordValid = await bcrypt.compare(password, tenant.password);
    if (!isPasswordValid) {
      throw problems.unauthorized("Invalid email or password.");
    }

    const accessToken = this.createSession(tenant);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
      },
      accessToken,
    };
  }

  private createSession(tenant: Tenant) {
    const accessToken = jwt.sign(
      { tenantId: tenant.id, email: tenant.email },
      this.deps.jwtSecret,
      { algorithm: "HS256", issuer: "ledger-api", expiresIn: "1h" },
    );
    return accessToken;
  }

  isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
