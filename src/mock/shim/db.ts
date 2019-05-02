const stateDbKey = '______';

export class Db {
    private o: {[k: string]: Buffer} = {};

    put(k: string, v: Buffer) {
        this.o[k] = v;
    }

    get(k: string): Buffer {
        const v = this.o[k];
        return v ? v : Buffer.from('');
    }

    del(k: string) {
        delete this.o[k];
    }

    range(sk: string, ek: string): string[] {
        return Object.keys(this.o).filter(k => k >= sk && k < ek);
    }
}

const dbs: {[collection: string]: Db} = {};

export function get(collection?: string): Db {
    const key = collection ? collection : stateDbKey;
    if (undefined === dbs[key]) {
        dbs[key] = new Db();
    }
    return dbs[key];
}
