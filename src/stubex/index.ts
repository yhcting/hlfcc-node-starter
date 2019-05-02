import { AssertionError } from 'assert';
import * as _ from 'lodash';
import * as Shim from 'fabric-shim';
import * as Kvc from './kvcache';
import { MockStub } from '../mock/shim/stub';

export interface Iterator<T> {
    next(): Promise<{k: string, v: T} | undefined>;
    close(): Promise<void>;
}

export interface StubEx extends Shim.Stub {
    db: Db;
    ut: Ut;
}

/**
 * Utility classes for shim.Stub
 */
class Ut {
    constructor(
        private ss: Shim.Stub
    ) {}

    isMock(): boolean {
        return this.ss instanceof MockStub;
    }

    getCreatorX509Pem() {
        return this.ss.getCreator().id_bytes.toString();
    }

    async invokeChaincode<T>(
        channelName: string,
        chaincodeName: string,
        fcn: string,
        arg: any
    ): Promise<T> {
        const res = await this.ss.invokeChaincode(
            chaincodeName,
            [   Buffer.from(fcn),
                Buffer.from(JSON.stringify(arg)) ],
            channelName);
        if (200 === res.status) {
            return JSON.parse((<Shim.Imp.SuccessResponse>res).payload.toString());
        } else {
            throw new Error((<Shim.Imp.ErrorResponse>res).message);
        }
    }
}

/**
 * For every interface, "false === !!collection"
 *   means "operate on world state"
 */
class Db {
    // '' === collection is for world state.
    private kvcs: {[collection: string]: Kvc.KVCache} = {};
    constructor(
        private ss: Shim.Stub
    ) {}

    private ensureKvc(collection?: string): Kvc.KVCache {
        const col = collection ? collection : '';
        if (!this.kvcs[col]) {
            this.kvcs[col] = new Kvc.KVCache(this.ss, col);
        }
        return this.kvcs[col];
    }

    /**
     * @return undefined if it doesn't exist.
     */
    async get(k: string, collection?: string): Promise<any> {
        const kvc = this.ensureKvc(collection);
        return await kvc.get(k);
    }

    async put(k: string, v: any, collection?: string): Promise<void> {
        const kvc = this.ensureKvc(collection);
        return await kvc.put(k, v);
    }

    async del(k: string, collection?: string): Promise<void> {
        const kvc = this.ensureKvc(collection);
        return await kvc.del(k);
    }

    async byRange<T>(startKey: string, endKey: string, collection?: string): Promise<Iterator<T>> {
        const kvc = this.ensureKvc(collection);
        return await kvc.byRange(startKey, endKey);
    }

    async byPartial<T>(objectType: string, attributes: string[], collection?: string): Promise<Iterator<T>> {
        const kvc = this.ensureKvc(collection);
        return await kvc.byPartial(objectType, attributes);
    }

    async commit(): Promise<void> {
        for (const _v of (<any>Object).values(this.kvcs)) {
            const kvc: Kvc.KVCache = _v;
            await kvc.commit();
        }
    }
}

export function mutate(stub: Shim.Stub): StubEx {
    const forceAssert = () => { throw new AssertionError(); };

    const ex: StubEx = {
        //
        // Extentions
        //
        db: new Db(stub),
        ut: new Ut(stub),

        //
        // APIs - state operation APIs - that MUST NOT be called directly!
        //
        getState: forceAssert,
        putState: forceAssert,
        deleteState: forceAssert,
        getStateByRange: forceAssert,
        getStateByPartialCompositeKey: forceAssert,
        getPrivateData: forceAssert,
        putPrivateData: forceAssert,
        deletePrivateData: forceAssert,
        getPrivateDataByRange: forceAssert,
        getPrivateDataByPartialCompositeKey: forceAssert,
        //
        // Bind to original stub
        //
        RESPONSE_CODE: stub.RESPONSE_CODE,
        getArgs: stub.getArgs.bind(stub),
        getStringArgs: stub.getStringArgs.bind(stub),
        getFunctionAndParameters: stub.getFunctionAndParameters.bind(stub),
        getTxID: stub.getTxID.bind(stub),
        getChannelID: stub.getChannelID.bind(stub),
        getCreator: stub.getCreator.bind(stub),
        getTransient: stub.getTransient.bind(stub),
        getSignedProposal: stub.getSignedProposal.bind(stub),
        getTxTimestamp: stub.getTxTimestamp.bind(stub),
        getBinding: stub.getBinding.bind(stub),
        getQueryResult: stub.getQueryResult.bind(stub),
        getHistoryForKey: stub.getHistoryForKey.bind(stub),
        invokeChaincode: stub.invokeChaincode.bind(stub),
        setEvent: stub.setEvent.bind(stub),
        createCompositeKey: stub.createCompositeKey.bind(stub),
        splitCompositeKey: stub.splitCompositeKey.bind(stub),
        getPrivateDataQueryResult: stub.getPrivateDataQueryResult.bind(stub),
    };

    return ex;
}

