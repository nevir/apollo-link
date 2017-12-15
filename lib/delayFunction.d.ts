import { Operation } from 'apollo-link';
export interface DelayFunction {
    (count: number, operation: Operation, error: any): number;
}
export interface DelayFunctionOptions {
    initial?: number;
    max?: number;
    jitter?: boolean;
}
export declare function buildDelayFunction({initial, max, jitter}?: DelayFunctionOptions): DelayFunction;
