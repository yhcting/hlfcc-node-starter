import { Imp } from 'fabric-shim';
import * as FabShim from 'fabric-shim';
import * as Utf8 from 'utf8';

import { MockStub } from './stub';

class ShimClass {
    private cci: FabShim.ChaincodeInterface;

    start(chaincode: FabShim.ChaincodeInterface): Imp.ChaincodeSupportClient {
        this.cci = chaincode;
    }

    success(payload?: Buffer): Imp.SuccessResponse {
        return {
            status: 200,
            payload: payload
        };
    }

    error(msg?: string): Imp.ErrorResponse {
        return {
            status: 500,
            message: msg
        };
    }

    newLogger(name: string): Object {
        throw 'NotImplemented';
    }

    //////////////////////////////////////////////////////////////////////////
    //
    // Only for mock testing
    //
    //////////////////////////////////////////////////////////////////////////
    /**
     * @param channel channel name(id)
     * @param mspId mspId of proposal creator
     * @param pem certificate pem of proposal creator
     * @param fcn function name
     * @param params function parameters
     */
    async mockInit(
        channel: string,
        mspId: string, pem: string,
        fcn: string, params: string[]
    ): Promise<Imp.Response> {
        const stub = new MockStub(channel,
            {
                mspid: mspId,
                id_bytes: Buffer.from(Utf8.encode(pem))
            },
            {
            fcn: fcn,
            params: params
        });
        return await this.cci.Init(stub);
    }

    async mockInvoke(
        channel: string,
        mspId: string, pem: string,
        fcn: string, params: string[],
        txTimestampMills?: number
    ): Promise<Imp.Response> {
        const stub = new MockStub(channel,
            {
                mspid: mspId,
                id_bytes: Buffer.from(Utf8.encode(pem))
            },
            {
                fcn: fcn,
                params: params,
            },
            txTimestampMills
        );
        return await this.cci.Invoke(stub);
    }
}

export const Shim = new ShimClass();

