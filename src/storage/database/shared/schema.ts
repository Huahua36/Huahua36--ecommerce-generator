import { pgTable, serial, timestamp, varchar, boolean, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表 - 存储用户信息和会员状态
export const users = pgTable(
  "users",
  {
    id: serial().notNull().primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    password: varchar("password", { length: 255 }),
    isAdmin: boolean("is_admin").default(false).notNull(),
    isMember: boolean("is_member").default(false).notNull(),
    memberExpireAt: timestamp("member_expire_at", { withTimezone: true, mode: 'string' }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
  },
  (table) => [
    index("users_phone_idx").on(table.phone),
  ]
);

// 会员订单表 - 存储会员购买记录
export const memberOrders = pgTable(
  "member_orders",
  {
    id: serial().notNull().primaryKey(),
    userId: integer("user_id").notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    amount: varchar("amount", { length: 20 }).notNull(), // 金额，如 "3.88"
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, paid, expired
    paymentMethod: varchar("payment_method", { length: 50 }), // alipay
    paymentAccount: varchar("payment_account", { length: 100 }), // 收款账号
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("member_orders_user_id_idx").on(table.userId),
    index("member_orders_phone_idx").on(table.phone),
  ]
);
