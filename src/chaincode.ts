import * as Shim from './shim';
import * as Stubex from './stubex';
import * as Fabcrypto from './crypto';
import * as Er from './error';


const D = function(...x: any[]) { console.log(...x); };
// const D = function(...x: any[]) { };


const maxAcceptableTimeDiffSeconds = 60 * 60; // 1 hour

/**
 * Return base64 string of invoker's public key.
 */
async function invokerPubKeyBase64(ss: Stubex.StubEx): Promise<string> {
    const x509Pem = ss.ut.getCreatorX509Pem();
    return Fabcrypto.pkFromX509(x509Pem, 'base64');
}

type FcnFunc = (
    ss: Stubex.StubEx,
    invoker: string,
    txepoch: number,
    arg: any) => Promise<any>;

export class Chaincode implements Shim.ChaincodeInterface {
    ///////////////////////////////////////////////////////////////////////////
    //
    ///////////////////////////////////////////////////////////////////////////
    private async init(ss: Stubex.StubEx): Promise<Shim.Imp.Response> {
        // let po = stub.getFunctionAndParameters();
        return Shim.Shim.success();
    }

    // Initialize the chaincode
    async Init(stub: Shim.Stub): Promise<Shim.Imp.Response> {
        try {
            const ss = Stubex.mutate(stub);
            const r = await this.init(ss);
            await ss.db.commit();
            return r;
        } catch (e) {
            if (e instanceof Er.Err) {
                return Shim.Shim.error(`${e.code}: ${e.message}`);
            } else {
                console.warn('Unexpected error is thrown!');
                console.warn(e.stack ? e.stack : '');
                return Shim.Shim.error(e.toString());
            }
        }
    }

    private async invoke(ss: Stubex.StubEx): Promise<Shim.Imp.Response> {
        const po = ss.getFunctionAndParameters();
        D('Invoke: ', po);
        const done = (v: any) => {
            D('Done:', v);
            return Shim.Shim.success(Buffer.from(JSON.stringify(v)));
        };

        { // verify timestamp
            const o = ss.getTxTimestamp();
            const nowsecs = Math.floor(new Date().valueOf() / 1000);
            let diffsecs = o.seconds.sub(nowsecs).toNumber();
            diffsecs = diffsecs < 0 ? -diffsecs : diffsecs;
            Er.a(diffsecs < maxAcceptableTimeDiffSeconds, Er.E.badRequest);
        }

        let arg: any;
        try {
            arg = JSON.parse(po.params[0]);
        } catch (e) {
            throw new Er.Err(Er.E.badRequest);
        }

        D('Arg: ', arg);

        const invoker = await invokerPubKeyBase64(ss);
        const txepoch = ss.getTxTimestamp().seconds.toNumber();

        switch (po.fcn) {
        default:
            throw new Er.Err(Er.E.badRequest);
        }
    }

    async Invoke(stub: Shim.Stub): Promise<Shim.Imp.Response> {
        try {
            const ss = Stubex.mutate(stub);
            const r = await this.invoke(ss);
            await ss.db.commit();
            return r;
        } catch (e) {
            // console.warn(e.stack ? e.stack : '');
            if (e instanceof Er.Err) {
                return Shim.Shim.error(`${e.code}: ${e.message ? e.message : ''}`);
            } else {
                console.warn('Unexpected error is thrown!');
                console.warn(e.stack ? e.stack : '');
                return Shim.Shim.error(e.toString());
            }
        }

    }
}
