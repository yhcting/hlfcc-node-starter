import * as Shim from 'fabric-shim';

export class MockClientIdentity implements Shim.ClientIdentity {
    constructor(stub: Shim.Stub) {
        throw 'NotImplemented';
    }
    getID(): string {
        throw 'NotImplemented';
    }
    getMSPID(): string {
        throw 'NotImplemented';
    }
    getAttributeValue(attrName: string): string | null {
        throw 'NotImplemented';
    }
    assertAttributeValue(attrName: string, attrValue: string): boolean {
        throw 'NotImplemented';
    }
    getX509Certificate(): Shim.Imp.X509Certificate | null {
        throw 'NotImplemented';
    }
}

