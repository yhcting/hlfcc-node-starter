export { Imp } from 'fabric-shim';
export * from './shim';

import * as Shim from 'fabric-shim';

// Re-exports from 'fabric-shim'
// Only types are used.
export interface ChaincodeInterface extends Shim.ChaincodeInterface {}
export interface Stub extends Shim.Stub {}
export interface StateQueryIterator extends Shim.StateQueryIterator {}
export interface HistoryQueryIterator extends Shim.HistoryQueryIterator {}


export const MOCK = true;
