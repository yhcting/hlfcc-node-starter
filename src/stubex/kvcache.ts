import * as Shim from 'fabric-shim';
import { AssertionError, ok as assert } from 'assert';
import * as _ from 'lodash';

// Constants comes from 'fabric-shim@1.2.0
const MAX_UNICODE_RUNE_VALUE = '\u{10ffff}';

// Abbreviation
// ck: Cache Key
// sk: Shim Key
export class Iterator {
    private ck: {
        l: string[], // key list
        /** current index of key list */
        i: number // key index
    };

    /** current element of shim */
    private sk: {
        e: any, // element from shim iterator
        k: string | undefined, // key of element
        hasNext: boolean, // is last element.
    } = {
        e: undefined,
        k: <any>undefined,
        hasNext: true
    };

    constructor(
        private kvc: KVCache,
        private shimitr: Shim.StateQueryIterator,
        sk: string, // start key (inclusive)
        ek: string, // end key (exclusive)
    ) {
        // Keys between start and end key
        this.ck = {
            l: kvc.wckeys().filter(k => k >= sk && k < ek).sort(),
            i: -1
        };
    }

    //////////////////////////////////////////////////////////////////////////

    private ckKey(): string {
        return this.ck.l[this.ck.i];
    }

    private ckValue(): Promise<any> {
        // Key is element of wckeys(ckKey())
        return this.kvc.wcValue(this.ckKey());
    }

    private ckDone(): boolean {
        return this.ck.i >= this.ck.l.length;
    }

    private ckMoveNext() {
        this.ck.i++;
    }

    //////////////////////////////////////////////////////////////////////////

    private skKey(): string {
        return this.sk.k!;
    }

    private skValue(): any {
        return this.sk.e;
    }

    private skDone(): boolean {
        return this.sk.k === undefined;
    }

    private async skMoveNext(): Promise<void> {
        const o = await this.shimitr.next();
        this.sk.hasNext = !o.done;
        if (undefined === o.value) {
            this.sk.k = undefined;
            this.sk.e = undefined;
            return;
        }
        this.sk.k = o.value.key;
        try {
            this.sk.e = JSON.parse(o.value.value.toString());
            // add read value to cache.
            this.kvc.cachingPreRead(this.sk.k!, this.sk.e);
        } catch (e) { throw new AssertionError(); }
    }

    //////////////////////////////////////////////////////////////////////////

    async init(): Promise<void> {
        this.ckMoveNext();
        // fetching the first
        await this.skMoveNext();
    }

    async next(): Promise<{k: string, v: any} | undefined> {
        const pickCk = () => {
            const k = this.ckKey();
            const v = this.ckValue();
            this.ckMoveNext();
            assert(undefined !== v);
            return {k: k, v: v};
        };

        const pickSk = async () => {
            const k = this.skKey();
            const v = this.skValue();
            await this.skMoveNext();
            return {k: k, v: v};
        };

        if (this.ckDone()) {
            if (this.skDone()) {
                return undefined;
            }
            return await pickSk();
        } else {
            if (this.skDone()) {
                // ckValue may be 'null' (means deleted!)
                while (true) {
                    const ckv = pickCk();
                    // Try next element by recursion, for deleted element.
                    return null !== ckv.v ? ckv : await this.next();
                }
            }
            // Both ck and sk, are valid
            if (this.ckKey() < this.skKey()) {
                return pickCk();
            } else if (this.ckKey() > this.skKey()) {
                return await pickSk();
            } else {
                // ckKey === skKey
                // cache value has priority because it's newly written value.
                // But, ckValue may be 'null' (means deleted!)
                await this.skMoveNext();
                const ckv = pickCk();
                // Try next element by recursion, for deleted element.
                return null !== ckv.v ? ckv : await this.next();
            }
        }
    }

    async close(): Promise<void> {
        await this.shimitr.close();
    }
}


/**
 * Value null means 'deleted'
 */
export class KVCache {
    Iterator = class {
        constructor() {}
    };
    /**
     * Value in rc(Read cache)
     * ---------------------------
     * - null: Value doesn't exist in database!
     * - undefined: Value is loaded in cache.
     *              That is, value is needed to be read from database.
     * - <otherwise>: cached.
     *
     * Value in wc(Write cache)
     * ----------------------------
     * - null: Value is deleted.
     * - undefined: Value is not modified.
     * - <otherwise>: Cached.
     */
    private rc: {[k: string]: any} = {};
    private wc: {[k: string]: any} = {};

    //
    // stub interface proxy
    //
    private readonly _get: (k: string) => Promise<Buffer>;
    private readonly _put: (k: string, v: Buffer) => Promise<void>;
    private readonly _del: (k: string) => Promise<void>;
    private readonly _byRange: (sk: string, ek: string) => Promise<Shim.StateQueryIterator>;
    // byPartial is implemented with byRange. (See fabric-shim@1.2.0)
    // private readonly _byPartial: (t: string, attrs: string[]) => Promise<shim.StateQueryIterator>;

    /**
     * @param collection "!!collection === false" for caching world state.
     */
    constructor(
        public readonly ss: Shim.Stub,
        collection?: string
    ) {
        if (collection) {
            // for private data
            this._get = async k => await ss.getPrivateData(collection!, k);
            this._put = async (k, v) => await ss.putPrivateData(collection!, k, v);
            this._del = async k => await ss.deletePrivateData(collection!, k);
            this._byRange = async (k, a) => await ss.getPrivateDataByRange(collection!, k, a);
            // this._byPartial = async (s, e) => await ss.getPrivateDataByPartialCompositeKey(collection!, s, e);
        } else {
            // for world state - just function mapping
            this._get = async k => await ss.getState(k);
            this._put = async (k, v) => ss.putState(k, v);
            this._del = async k => ss.deleteState(k);
            this._byRange = async (k, a) => await ss.getStateByRange(k, a);
            // this._byPartial = ss.getStateByPartialCompositeKey;
        }
    }

    async get(k: string): Promise<any> {
        const toJson = (d: Buffer): any => {
            try {
                return JSON.parse(d.toString());
            } catch (e) {
                throw new AssertionError();
            }
        };

        let v = this.wcValue(k);
        if (null === v) {
            // deleted!
            return undefined;
        } else if (undefined !== v) {
            return v;
        }
        // v is undefined

        v = this.rc[k];
        if (undefined === v) {
            // v should be read from underline database.
            const buf = await this._get(k);
            if (0 === buf.length) {
                v = null;
            } else {
                v = toJson(buf);
                assert(null !== v);
            }
            this.rc[k] = v;
        }
        return null === v ? undefined : v;
    }

    async put(k: string, v: any): Promise<void> {
        assert(undefined !== v && null !== v);
        this.wc[k] = v;
    }

    async del(k: string): Promise<void> {
        this.wc[k] = null;
    }

    async byRange(
        startKey: string, endKey: string
    ): Promise<Iterator> {
        // Only write cache affects to key-existence!
        const shimitr = await this._byRange(startKey, endKey);
        const itr = new Iterator(this, shimitr, startKey, endKey);
        await itr.init();
        return itr;
    }

    async byPartial(
        objectType: string, attributes: string[]
    ): Promise<Iterator> {
        const key = this.ss.createCompositeKey(objectType, attributes);
        // Implementation comes from 'fabric-shim@1.2.0'
        return await this.byRange(key, key + MAX_UNICODE_RUNE_VALUE);
    }

    async commit(): Promise<void> {
        for (const [k, v] of (<any>Object).entries(this.wc)) {
            assert(undefined !== v);
            if (null === v) {
                await this._del(k);
            } else {
                await this._put(k, Buffer.from(JSON.stringify(v)));
            }
        }
    }

    //////////////////////////////////////////////////////////////////////////
    //
    // To support Iterator
    // WARN: These MUST be called carefully.
    // At this moment, this is called by only 'Iterator' above.
    //
    //////////////////////////////////////////////////////////////////////////
    cachingPreRead(k: string, v: any) {
        assert(undefined !== v && null !== v);
        this.rc[k] = v;
    }

    wckeys(): string[] {
        return Object.keys(this.wc);
    }

    wcValue(k: string): any {
        return this.wc[k];
    }
}
