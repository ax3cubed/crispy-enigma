declare module 'pg' {
	export interface QueryResult<T = any> {
		rows: T[]
		rowCount: number
		command?: string
	}

	export class Pool {
		constructor(opts?: any)
		query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>
		connect(): Promise<any>
		end(): Promise<void>
	}

	export type PoolConfig = any
	export default Pool
}
