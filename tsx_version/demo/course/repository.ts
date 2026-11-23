import type { State } from './domain';
export type Repository = { read(): Promise<State>; change<T>(fn: (state: State) => T): Promise<T> };
export { getSqliteRepository as getRepository } from './sqlite-repository';
