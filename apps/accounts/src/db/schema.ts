import { sql } from 'drizzle-orm'
import * as p from 'drizzle-orm/sqlite-core'

export const usersTable = p.sqliteTable('users', (t) => ({
	id: t.text('id').primaryKey(),
	email: t.text('email').notNull().unique(),
	createdAt: t.text('created_at').notNull().default(sql`(datetime('now'))`),
	updatedAt: t.text('updated_at').notNull().default(sql`(datetime('now'))`),
}))

export type UserRow = typeof usersTable.$inferSelect

export const walletsTable = p.sqliteTable(
	'wallets',
	(t) => ({
		id: t.text('id').primaryKey(),
		userId: t
			.text('user_id')
			.notNull()
			.references(() => usersTable.id),
		credentialId: t.text('credential_id').notNull().unique(),
		publicKey: t.text('public_key').notNull(),
		publicKeyHex: t.text('public_key_hex'),
		transports: t.text('transports'),
		label: t.text('label').notNull(),
		address: t.text('address').notNull().unique(),
		createdAt: t.text('created_at').notNull().default(sql`(datetime('now'))`),
		updatedAt: t.text('updated_at').notNull().default(sql`(datetime('now'))`),
	}),
	(table) => [p.index('idx_wallets_user_id').on(table.userId)],
)

export type WalletRow = typeof walletsTable.$inferSelect
