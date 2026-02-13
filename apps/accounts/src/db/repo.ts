import { and, eq, sql } from 'drizzle-orm'
import type { Db } from './client'
import { createId } from './ids'
import {
	type UserRow,
	type WalletRow,
	usersTable,
	walletsTable,
} from './schema'

export function createRepo(db: Db) {
	return {
		async getUserByEmail(email: string): Promise<UserRow | null> {
			const row = await db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.get()
			return row ?? null
		},

		async getUserById(id: string): Promise<UserRow | null> {
			const row = await db
				.select()
				.from(usersTable)
				.where(eq(usersTable.id, id))
				.get()
			return row ?? null
		},

		async upsertUserByEmail(
			email: string,
		): Promise<{ user: UserRow; isNewUser: boolean }> {
			const existing = await this.getUserByEmail(email)
			if (existing) return { user: existing, isNewUser: false }
			const id = createId('usr')
			await db.insert(usersTable).values({ id, email })
			const user = (await this.getUserById(id)) as UserRow
			return { user, isNewUser: true }
		},

		async getWalletsByUserId(userId: string): Promise<WalletRow[]> {
			return db
				.select()
				.from(walletsTable)
				.where(eq(walletsTable.userId, userId))
				.all()
		},

		async getWalletByAddress(address: string): Promise<WalletRow | null> {
			const row = await db
				.select()
				.from(walletsTable)
				.where(sql`lower(${walletsTable.address}) = ${address.toLowerCase()}`)
				.get()
			return row ?? null
		},

		async getWalletByCredentialId(
			credentialId: string,
		): Promise<WalletRow | null> {
			const row = await db
				.select()
				.from(walletsTable)
				.where(eq(walletsTable.credentialId, credentialId))
				.get()
			return row ?? null
		},

		async createWallet(params: {
			userId: string
			credentialId: string
			publicKey: string
			publicKeyHex?: string
			transports?: string[]
			label: string
			address: string
		}): Promise<WalletRow> {
			const id = createId('wal')
			await db.insert(walletsTable).values({
				id,
				userId: params.userId,
				credentialId: params.credentialId,
				publicKey: params.publicKey,
				publicKeyHex: params.publicKeyHex,
				transports: params.transports
					? JSON.stringify(params.transports)
					: null,
				label: params.label,
				address: params.address,
			})
			return (await db
				.select()
				.from(walletsTable)
				.where(eq(walletsTable.id, id))
				.get()) as WalletRow
		},

		async updateWalletLabel(
			walletId: string,
			userId: string,
			label: string,
		): Promise<void> {
			await db
				.update(walletsTable)
				.set({ label, updatedAt: new Date().toISOString() })
				.where(
					and(eq(walletsTable.id, walletId), eq(walletsTable.userId, userId)),
				)
		},
	}
}

export type Repo = ReturnType<typeof createRepo>
