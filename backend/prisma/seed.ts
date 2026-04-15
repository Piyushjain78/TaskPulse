import { PrismaClient, Role, TaskPriority, TaskStatus, TimerRunState } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const manager1 = await prisma.user.upsert({
    where: { email: "manager1@test.com" },
    update: { phone: "+919876543210" },
    create: {
      name: "Manager One",
      email: "manager1@test.com",
      phone: "+919876543210",
      password: passwordHash,
      role: Role.MANAGER,
    },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: "manager2@test.com" },
    update: { phone: "+919876543211" },
    create: {
      name: "Manager Two",
      email: "manager2@test.com",
      phone: "+919876543211",
      password: passwordHash,
      role: Role.MANAGER,
    },
  });

  const employee1 = await prisma.user.upsert({
    where: { email: "employee1@test.com" },
    update: { managerId: manager1.id, phone: "+919811111111" },
    create: {
      name: "Employee One",
      email: "employee1@test.com",
      phone: "+919811111111",
      password: passwordHash,
      role: Role.EMPLOYEE,
      managerId: manager1.id,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: "employee2@test.com" },
    update: { managerId: manager1.id, phone: "+919822222222" },
    create: {
      name: "Employee Two",
      email: "employee2@test.com",
      phone: "+919822222222",
      password: passwordHash,
      role: Role.EMPLOYEE,
      managerId: manager1.id,
    },
  });

  const employee3 = await prisma.user.upsert({
    where: { email: "employee3@test.com" },
    update: { managerId: manager2.id, phone: "+919833333333" },
    create: {
      name: "Employee Three",
      email: "employee3@test.com",
      phone: "+919833333333",
      password: passwordHash,
      role: Role.EMPLOYEE,
      managerId: manager2.id,
    },
  });

  const existing = await prisma.task.findFirst({
    where: { title: "Seed: Review API documentation" },
  });
  if (!existing) {
    await prisma.task.create({
      data: {
        title: "Seed: Review API documentation",
        description: "Read through OpenAPI specs and note gaps.",
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        assignedTo: employee1.id,
        createdBy: manager1.id,
        timerRunState: TimerRunState.STOPPED,
      },
    });
  }

  const existing2 = await prisma.task.findFirst({
    where: { title: "Seed: Update onboarding copy" },
  });
  if (!existing2) {
    await prisma.task.create({
      data: {
        title: "Seed: Update onboarding copy",
        description: "Align copy with new product positioning.",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assignedTo: employee2.id,
        createdBy: manager1.id,
        timerRunState: TimerRunState.RUNNING,
        activeSegmentStart: new Date(),
        timeLogs: {
          create: {
            startTime: new Date(),
            endTime: null,
          },
        },
      },
    });
  }

  console.log("Seed completed:", {
    manager1: manager1.email,
    manager2: manager2.email,
    employees: [employee1.email, employee2.email, employee3.email],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
