import {
    Stub,
    StateQueryIterator,
    HistoryQueryIterator,
    Imp
} from 'fabric-shim';
import * as utf8 from 'utf8';
import * as ByteBuffer from 'bytebuffer';
import * as Long from 'long';
import * as db from './db';

class StateIterator {
    private i: number = -1; // current index.

    constructor(
        // tslint:disable-next-line:no-shadowed-variable
        private readonly db: db.Db,
        private readonly keys: string[]
    ) {}

    async close(): Promise<any> {}
    async next(): Promise<Imp.IteratorElem> {
        const i  = ++this.i;
        const e: Imp.IteratorElem = {
            done: i >= this.keys.length
        };
        if (i < this.keys.length) {
            const key = this.keys[i];
            const v = this.db.get(key);
            e.value = {
                namespace: 'Mock',
                key: key,
                value: Buffer.from(v.toString())
            };
        }
        return e;
    }
}


export class MockStub implements Stub {
    private static readonly COMPOSITEKEY_NS = '\x00';
    private static readonly MIN_UNICODE_RUNE_VALUE = '\u0000';
    private static readonly MAX_UNICODE_RUNE_VALUE = '\u{10ffff}';

    RESPONSE_CODE: {
        OK: 200;
        ERRORTHRESHOLD: 400;
        ERROR: 500
    };

    private readonly txId: string;
    private readonly txTimestamp: Imp.Timestamp;

    constructor(
        private readonly channelId: string,
        private readonly creator: Imp.ProposalCreator,
        private readonly fcnParams: Imp.FunctionAndParameters,
        txTimestampMills?: number,
    ) {
        const uuidv4 = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
                .replace(/[xy]/g, function(c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
        };

        // Mock txId as uuid.
        this.txId = uuidv4();
        const mills = txTimestampMills ? txTimestampMills : new Date().valueOf();
        const secs = Math.floor(mills / 1000);
        this.txTimestamp = {
            seconds: Long.fromNumber(secs),
            nanos: (mills - (secs * 1000)) * 1000 * 1000
        };
    }

    private validateCompositeKeyAttribute(attr: string) {
        if (!attr || typeof attr !== 'string' || attr.length === 0) {
            throw new Error('object type or attribute not a non-zero length string');
        }
        utf8.decode(attr);
    }


    getArgs(): string[] {
        return this.getStringArgs();
    }

    getStringArgs(): string[] {
        return this.fcnParams.params;
    }

    getFunctionAndParameters(): Imp.FunctionAndParameters {
        return this.fcnParams;
    }

    getTxID(): string {
        return this.txId;
    }

    getChannelID(): string {
        return this.channelId;
    }

    getCreator(): Imp.ProposalCreator {
        return this.creator;
    }

    getTransient(): Map<string, Buffer> {
        throw 'NotImplemented';
    }

    getSignedProposal(): Imp.SignedProposal {
        throw 'NotImplemented';
    }

    getTxTimestamp(): Imp.Timestamp {
        return this.txTimestamp;
    }

    getBinding(): string {
        throw 'NotImplemented';
    }

    async getState(key: string): Promise<Buffer> {
        return db.get().get(key);
    }

    async putState(key: string, value: Buffer): Promise<void> {
        db.get().put(key, value);
    }

    async deleteState(key: string): Promise<void> {
        db.get().del(key);
    }

    async getStateByRange(startKey: string, endKey: string
    ): Promise<StateQueryIterator> {
        const d = db.get();
        const keys = d.range(startKey, endKey);
        return <any>(new StateIterator(d, keys));
    }

    async getQueryResult(query: string): Promise<StateQueryIterator> {
        throw 'NotImplemented';
    }

    async getHistoryForKey(key: string): Promise<HistoryQueryIterator> {
        throw 'NotImplemented';
    }

    async invokeChaincode(
        chaincodeName: string, args: Buffer[], channel: string
    ): Promise<Imp.Response> {
        throw 'NotImplemented';
    }

    setEvent(name: string, payload: Buffer): void {
        throw 'NotImplemented';
    }

    createCompositeKey(objectType: string, attributes: string[]): string {
        // From official 'fabric-shim@1.2.0' module implementation
        this.validateCompositeKeyAttribute(objectType);
        if (!Array.isArray(attributes)) {
            throw new Error('attributes must be an array');
        }

        let compositeKey = MockStub.COMPOSITEKEY_NS
            + objectType
            + MockStub.MIN_UNICODE_RUNE_VALUE;
        attributes.forEach((attribute) => {
            this.validateCompositeKeyAttribute(attribute);
            compositeKey = compositeKey
                + attribute
                + MockStub.MIN_UNICODE_RUNE_VALUE;
        });
        return compositeKey;
    }

    splitCompositeKey(compositeKey: string
    ): {objectType: string, attributes: string[]} {
        // From official 'fabric-shim@1.2.0' module implementation
        const result: any = {objectType: null, attributes: []};
        if (compositeKey
            && compositeKey.length > 1
            && compositeKey.charAt(0) === MockStub.COMPOSITEKEY_NS
        ) {
            const splitKey = compositeKey.substring(1).split(
                MockStub.MIN_UNICODE_RUNE_VALUE);
            if (splitKey[0]) {
                result.objectType = splitKey[0];
                splitKey.pop();
                if (splitKey.length > 1) {
                    splitKey.shift();
                    result.attributes = splitKey;
                }
            }
        }
        return result;
    }

    async getStateByPartialCompositeKey(
        objectType: string, attributes: string[]
    ): Promise<StateQueryIterator> {
        const key = this.createCompositeKey(objectType, attributes);
        return await this.getStateByRange(
            key, key + MockStub.MAX_UNICODE_RUNE_VALUE);
    }

    async getPrivateData(collection: string, key: string): Promise<any> {
        return db.get(collection).get(key);
    }

    async putPrivateData(
        collection: string, key: string, value: Buffer
    ): Promise<void> {
        return db.get(collection).put(key, value);
    }

    async deletePrivateData(collection: string, key: string): Promise<void> {
        return db.get(collection).del(key);
    }

    async getPrivateDataByRange(
        collection: string, startKey: string, endKey: string
    ): Promise<StateQueryIterator> {
        const d = db.get(collection);
        const keys = d.range(startKey, endKey);
        return <any>(new StateIterator(d, keys));
    }

    async getPrivateDataByPartialCompositeKey(
        collection: string,
        objectType: string,
        attributes: string[]
    ): Promise<StateQueryIterator> {
        const key = this.createCompositeKey(objectType, attributes);
        return await this.getPrivateDataByRange(collection, key, key + MockStub.MAX_UNICODE_RUNE_VALUE);
    }

    getPrivateDataQueryResult(collection: string, query: string
    ): Promise<StateQueryIterator> {
        throw 'NotImplemented';
    }
}

