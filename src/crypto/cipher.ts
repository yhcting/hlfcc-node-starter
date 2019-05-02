import { ok as assert } from 'assert';
import * as Crypto from 'crypto';
const Elliptic = require('elliptic');
const Jsrsa = require('jsrsasign');

const ECDS_PUBKEY_UNCOMPRESS_FORM_TAG = 4;
const ec = new Elliptic.ec('p256');
const EC_KEY_SIZE = 32;

const AES_ALGORITHM = 'aes128';
const AES_BLOCK_SIZE = 16; /** AES 128 - Especially popular at Golang */
/** Keep safe guard as 32 bytes */
export const CIPHER_SAFE_GUARD = 'CRYPTO-CIPHER-SAFE-GUARD';
const cipherSafeGuard = Buffer.from(CIPHER_SAFE_GUARD);

export function pkFromX509(pem: string): Buffer;
export function pkFromX509(pem: string, encoding: 'base64' | 'hex'): string;
export function pkFromX509(pem: string, encoding?: 'base64' | 'hex'): string | Buffer {
    const pubobj: any = Jsrsa.KEYUTIL.getKey(pem);
    const key = Buffer.from(pubobj.pubKeyHex, 'hex');
    return encoding ? key.toString(encoding) : key;
}

export function skFromPem(pem: string): Buffer;
export function skFromPem(pem: string, encoding: 'base64' | 'hex'): string;
export function skFromPem(pem: string, encoding?: 'base64' | 'hex'): string | Buffer {
    const keyobj = Jsrsa.KEYUTIL.getKeyFromPlainPrivatePKCS8PEM(pem);
    const key = Buffer.from(keyobj.prvKeyHex, 'hex');
    return encoding ? key.toString(encoding) : key;
}

export function pkcs5AddPadding(b: Buffer, sz: number): Buffer {
    const l = sz - b.length % sz;
    const pad = Buffer.alloc(l, l);
    return Buffer.concat([b, pad]);
}

export function pkcs5TrimPadding(b: Buffer, sz: number): Buffer {
    const l = b[b.length - 1];
    assert(l <= sz);
    return b.slice(0, b.length - l);
}

export function prettyHex(s: string) {
    const m = s.match(/(.{2})/g);
    return null === m ? null : m.join(':');
}

/**
 * Algorithm is fixed to AES-128-CBC at this moment.
 */
export function aesCbcEncrypt(
    key: Buffer, iv: Buffer, data: Buffer
): Buffer {
    // Algorithm is fixed to AES-128-CBC!
    assert(AES_BLOCK_SIZE === iv.length);
    const guarded = Buffer.concat([cipherSafeGuard, data]);
    const padded = pkcs5AddPadding(guarded, AES_BLOCK_SIZE);
    const cip = Crypto.createCipheriv(AES_ALGORITHM, key, iv);
    cip.setAutoPadding(false);
    return Buffer.concat([cip.update(padded), cip.final()]);
}


export function aesCbcDecrypt(
    key: Buffer, iv: Buffer, encrypted: Buffer
) {
    // Algorithm is fixed to AES-128-CBC!
    assert(AES_BLOCK_SIZE === iv.length);
    const cip = Crypto.createDecipheriv(AES_ALGORITHM, key, iv);
    cip.setAutoPadding(false);
    const decrypted = Buffer.concat([cip.update(encrypted), cip.final()]);
    if (!cipherSafeGuard.equals(decrypted.slice(0, cipherSafeGuard.length))) {
        throw new Error('Decryption fails');
    }
    return pkcs5TrimPadding(decrypted, AES_BLOCK_SIZE)
        .slice(cipherSafeGuard.length);
}

/**
 * WARN: NOTE that this is very expensive operation!
 * Therefore, you may need to avoid running this at main context!
 * (Ex. subprocess or webworker-thread ...)
 *
 * Using ECDHE with AES-128-CBC.
 * (HMAC is NOT used. It can be covered by using TLS at GRPC at Fabric.)
 * The reason why AES-128 is used instead of AES-256 is to support this
 *   cipher protocol easily at Golang and AES-128 is safe enough in this case.
 */
export function ecdheEncrypt(yourPubKey: Buffer, data: Buffer): Buffer {
    if ((EC_KEY_SIZE * 2 + 1) !== yourPubKey.length) {
        throw new Error('Invalid ECDSA-P256 public key');
    }
    const yourKey = ec.keyFromPublic(yourPubKey);
    const yourPub = yourKey.getPublic();

    // 32 bytes for p256;
    const ephKey = ec.keyFromPrivate(Crypto.randomBytes(32));
    const ephPub = ephKey.getPublic();
    const ephPubEncoded: any[] = ephPub.encode();

    // ECDH key is NOT used directly for security reason.
    // (See. https://www.rfc-editor.org/rfc/rfc7748.txt)
    // Deriving symmetric cipher key: sha256 of
    // - pubkey(uncompressed) for ecdh-secret
    // - pubkey(uncompressed) of encryptor
    // - pubkey(uncompressed) of decryptor
    const ecdhPub = yourPub.mul(ephKey.getPrivate());
    const keysrc = Buffer.from([
        ...ecdhPub.encode(),
        ...ephPubEncoded,
        ...yourPub.encode()
    ]);
    const shared = Crypto.createHash('sha256')
        .update(keysrc)
        .digest();
    const sharedSub = shared.slice(0, AES_BLOCK_SIZE);
    const iv = Crypto.randomBytes(AES_BLOCK_SIZE);
    const ct = aesCbcEncrypt(sharedSub, iv, data);
    assert(ephPubEncoded.length < 0x100);
    return Buffer.concat([
        Buffer.from([ephPubEncoded.length]),
        Buffer.from(ephPubEncoded),
        iv,
        ct
    ]);
}

/**
 * See comments of encrypt() for details.
 */
export function ecdheDecrypt(myPrvKey: Buffer, data: Buffer): Buffer {
    const ephLen: number = data[0];
    const ephPubKey = data.slice(1, 1 + ephLen);
    const iv = data.slice(1 + ephLen, 1 + ephLen + AES_BLOCK_SIZE);
    const encrypted = data.slice(1 + ephLen + AES_BLOCK_SIZE);
    if (EC_KEY_SIZE !== myPrvKey.length) {
        throw new Error('Invalid ECDSA-P256 private key');
    }
    if (encrypted.length < AES_BLOCK_SIZE
        || encrypted.length < cipherSafeGuard.length
        || 1 !== (ephLen % 2)
    ) {
        throw new Error('Invalid cipher data');
    }
    const myKey = ec.keyFromPrivate(myPrvKey);
    const myPub = myKey.getPublic();
    const ephKey = ec.keyFromPublic(ephPubKey);
    const ephPub = ephKey.getPublic();
    const ecdhPub = ephPub.mul(myKey.getPrivate());
    const keysrc = Buffer.from([
        ...ecdhPub.encode(),
        ...ephPub.encode(),
        ...myPub.encode()
    ]);
    const shared = Crypto.createHash('sha256')
        .update(keysrc)
        .digest();
    const sharedSub = shared.slice(0, AES_BLOCK_SIZE);
    return aesCbcDecrypt(sharedSub, iv, encrypted);
}
