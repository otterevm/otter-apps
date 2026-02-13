import { customAlphabet } from 'nanoid'

const BASE62_ALPHABET =
	'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

const generateRandomBase62 = customAlphabet(BASE62_ALPHABET, 24)

export type IdPrefix = 'usr' | 'wal'

export function createId(prefix: IdPrefix): string {
	return `${prefix}_${generateRandomBase62()}`
}
