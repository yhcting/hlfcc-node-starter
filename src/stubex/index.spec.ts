// tslint:disable:no-unused-expression
// tslint:disable:prefer-const

import { expect } from 'chai';
import * as Utf8 from 'utf8';
import { MockStub } from '../mock/shim/stub';
import * as Stubex from './';

const testUser = {
    mspId: 'DEFAULT',
    pem:
`-----BEGIN CERTIFICATE-----
MIICNjCCAd2gAwIBAgIRAMnf9/dmV9RvCCVw9pZQUfUwCgYIKoZIzj0EAwIwgYEx
CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4g
RnJhbmNpc2NvMRkwFwYDVQQKExBvcmcxLmV4YW1wbGUuY29tMQwwCgYDVQQLEwND
T1AxHDAaBgNVBAMTE2NhLm9yZzEuZXhhbXBsZS5jb20wHhcNMTcxMTEyMTM0MTEx
WhcNMjcxMTEwMTM0MTExWjBpMQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZv
cm5pYTEWMBQGA1UEBxMNU2FuIEZyYW5jaXNjbzEMMAoGA1UECxMDQ09QMR8wHQYD
VQQDExZwZWVyMC5vcmcxLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEZ8S4V71OBJpyMIVZdwYdFXAckItrpvSrCf0HQg40WW9XSoOOO76I+Umf
EkmTlIJXP7/AyRRSRU38oI8Ivtu4M6NNMEswDgYDVR0PAQH/BAQDAgeAMAwGA1Ud
EwEB/wQCMAAwKwYDVR0jBCQwIoAginORIhnPEFZUhXm6eWBkm7K7Zc8R4/z7LW4H
ossDlCswCgYIKoZIzj0EAwIDRwAwRAIgVikIUZzgfuFsGLQHWJUVJCU7pDaETkaz
PzFgsCiLxUACICgzJYlW7nvZxP7b6tbeu3t8mrhMXQs956mD4+BoKuNI
-----END CERTIFICATE-----`
};


describe('StubEx', function () {
    let stub: MockStub;

    const getState = async function (k: string): Promise<any> {
        return JSON.parse((await stub.getState(k)).toString());
    };

    before(async function () {
        stub = new MockStub(
            'myc',
            {
                mspid: testUser.mspId,
                id_bytes: Buffer.from(Utf8.encode(testUser.pem))
            },
            {
                fcn: '',
                params: ['']
            });
        // Initialize MockStub DB.
        for (let v of [
            '1000', '1010', '1020',
            '2000', '2010', '2020', '2030', '2040', '2050',
            '3000', '3010', '3020',
        ]) {
            await stub.putState(v, Buffer.from(JSON.stringify(v)));
        }
    });

    it('Init from Stub', function () {
        let ss = Stubex.mutate(stub);
        expect(ss).not.undefined;
    });

    it('Get / Set (Read after Write)', async function () {
        let ss = Stubex.mutate(stub);
        expect(await ss.db.get('1010')).equal('1010');
        expect(await ss.db.get('4010')).undefined;

        // Read after write
        await ss.db.put('1010', '1011');
        expect((await ss.db.get('1010'))).equal('1011');
        // Global state should NOT be changed
        expect(await getState('1010')).equal('1010');

        await ss.db.put('1040', '1040');
        expect((await ss.db.get('1040'))).equal('1040');
        expect((await stub.getState('1040')).length).equal(0);
    });

    it('Del', async function () {
        let ss = Stubex.mutate(stub);
        ss.db.del('1010');
        expect(await ss.db.get('1010')).undefined;
        expect(await getState('1010')).equal('1010');
    });

    it('Commit', async function () {
        let ss = Stubex.mutate(stub);
        await ss.db.put('4000', '4000');
        await ss.db.put('4010', '4010');
        await ss.db.commit();
        expect(await getState('4000')).equal('4000');
        expect(await ss.db.get('4000')).equal('4000');
    });

    it('By range', async function () {
        let ss = Stubex.mutate(stub);
        let itr = await ss.db.byRange('1000', '2000');
        let o: any = await itr.next();
        expect(await ss.db.get('1000')).equal('1000');
        expect(o.k).equal('1000');
        expect(o.v).equal('1000');

        o = await itr.next();
        expect(o.k).equal('1010');
        expect(o.v).equal('1010');

        o = await itr.next();
        expect(o.k).equal('1020');
        expect(o.v).equal('1020');

        o = await itr.next();
        expect(o).undefined;

        o = await itr.next();
        expect(o).undefined;

        await itr.close();
    });

    it('By range with cached value', async function () {
        let ss = Stubex.mutate(stub);
        // update values
        await ss.db.put('2000', '2000+');
        await ss.db.put('2030', '2030+');
        // add and delete
        await ss.db.del('2010');
        await ss.db.del('2020');
        await ss.db.put('2001', '2001');
        await ss.db.put('2021', '2021');
        await ss.db.put('2022', '2022');
        await ss.db.del('2040');
        await ss.db.del('2050');


        let itr = await ss.db.byRange('2000', '3000');
        let o: any = await itr.next();
        expect(await ss.db.get('2000')).equal('2000+');
        expect(o.k).equal('2000');
        expect(o.v).equal('2000+');

        o = await itr.next();
        expect(o.k).equal('2001');
        expect(o.v).equal('2001');

        o = await itr.next();
        expect(o.k).equal('2021');
        expect(o.v).equal('2021');

        o = await itr.next();
        expect(o.k).equal('2022');
        expect(o.v).equal('2022');

        o = await itr.next();
        expect(o.k).equal('2030');
        expect(o.v).equal('2030+');

        o = await itr.next();
        expect(o).undefined;

        o = await itr.next();
        expect(o).undefined;

        await itr.close();
    });
});
