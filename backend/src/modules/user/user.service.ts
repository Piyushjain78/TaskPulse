import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import type { JwtPayload } from "../../middleware/auth";

export class UserService {
  listEmployeesForManager(manager: JwtPayload) {
    if (manager.role !== Role.MANAGER) {
      throw new HttpError(403, "Managers only");
    }
    return prisma.user.findMany({
      where: { role: Role.EMPLOYEE, managerId: manager.sub },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
  }
}
