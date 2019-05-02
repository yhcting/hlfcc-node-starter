
export enum E {
    unknown = 'unknown',
    notImplemented = 'notImplemented',
    permission = 'permission',
    badRequest = 'badRequest',
}

//////////////////////////////////////////////////////////////////////////////
//
// Why custom Err is used?
// See
//   - https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md
//      #extending-built-ins-like-error-array-and-map-may-no-longer-work
//   - https://stackoverflow.com/questions/30402287/extended-errors-do-not-have-message-or-stack-trace
//
//////////////////////////////////////////////////////////////////////////////
// DO NOT extends Error. See file-header-comments above.
// Even if we have workaround, to remove confusion and difference among
//   target(es5, es6), custom class is ued.
export class Err<EC> {
    readonly stack: string | undefined; // This is 'non-enumerable'
    constructor (
        public code: EC,
        public message?: string,
        public body?: any /** additonal error data */
    ) {
        // Object.setPrototypeOf(this, ErrBase.prototype);
        if (Error.hasOwnProperty('captureStackTrace')) {
            (<any>Error).captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error()).stack;
        }
        Object.defineProperty(this, 'stack', {
            enumerable: true
        });
    }

    toString(debug = false): string {
        let s = `Err: ${this.code ? this.code : ''}`;
        if (this.message) {
            s += '\n' + this.message;
        }
        if (debug) {
            s += '\n' + this.stack;
        }
        return s;
    }
}

export function ethrow<EC>(e: EC, m?: string, body?: any): never {
    throw new Err(e, m, body);
}

/**
 * Assert Verification. Frequently used. So, name is simplified as 'a'.
 */
export function a<EC>(cond: any, e: EC, msg?: string, body?: any) {
    if (!cond) {
        throw new Err(e, msg, body);
    }
}
