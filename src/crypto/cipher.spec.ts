import { expect } from 'chai';
import * as cipher from './cipher';

const u0 = {
        sk:
`-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDIv/Fwgko0SKNS9M
jLuhZcoj2p3Y48XKdMwF2H+iXfuhRANCAAT2dvcTbb13NsXu0oeTQOzoB9spqrek
5xzPYO8Brd8912gQ2gv+3dk6qsczhCMbvAxAj2OsHkgDq90RmyqNpDH8
-----END PRIVATE KEY-----
`,
        cert:
`-----BEGIN CERTIFICATE-----
MIIB8DCCAZagAwIBAgIRANUQaN/FZg+72aq9DAVX8PcwCgYIKoZIzj0EAwIwVzEL
MAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBG
cmFuY2lzY28xCzAJBgNVBAoTAnAwMQ4wDAYDVQQDEwVjYS5wMDAeFw0xODEwMTEw
NzEzNThaFw0yODEwMDgwNzEzNThaME0xCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpD
YWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4gRnJhbmNpc2NvMREwDwYDVQQDDAhVc2Vy
MUBwMDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABPZ29xNtvXc2xe7Sh5NA7OgH
2ymqt6TnHM9g7wGt3z3XaBDaC/7d2TqqxzOEIxu8DECPY6weSAOr3RGbKo2kMfyj
TTBLMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMCsGA1UdIwQkMCKAIPNZ
zEsHRxZmiDrtIVbF2tWqeV+0z0/F+58SI1yDwHegMAoGCCqGSM49BAMCA0gAMEUC
IQD/pRkyaKYQHnPPnY+1LLUca7tasrhLe8NntAA3HvBMoQIgF4M8M4yVeEqcJV98
nmpK05ueMyESUsTMbpmJ54lKB3w=
-----END CERTIFICATE-----
`};

const u1 = {
        sk:
`-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg8j89OoXCno1UJVG9
MjHMOsVFFskay6VD4tZfyaDJO7ChRANCAASpWIyMIBusi04n/m/ROUYbLWoIR0Go
7fOCmuk/uTJSf3vtmsh/zqOHcbA8JT0ZZCMXrxu0T3n+G6Z6CqJagg25
-----END PRIVATE KEY-----
`,
        cert:
`-----BEGIN CERTIFICATE-----
MIIB7zCCAZagAwIBAgIRAOxVNmSpXLEbepeowr1ExmowCgYIKoZIzj0EAwIwVzEL
MAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBG
cmFuY2lzY28xCzAJBgNVBAoTAnAwMQ4wDAYDVQQDEwVjYS5wMDAeFw0xODEwMTEw
NzEzNThaFw0yODEwMDgwNzEzNThaME0xCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpD
YWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4gRnJhbmNpc2NvMREwDwYDVQQDDAhVc2Vy
MkBwMDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABKlYjIwgG6yLTif+b9E5Rhst
aghHQajt84Ka6T+5MlJ/e+2ayH/Oo4dxsDwlPRlkIxevG7RPef4bpnoKolqCDbmj
TTBLMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMCsGA1UdIwQkMCKAIPNZ
zEsHRxZmiDrtIVbF2tWqeV+0z0/F+58SI1yDwHegMAoGCCqGSM49BAMCA0cAMEQC
IClrsGbGW55txFaFlXwNeReg0XLk3BN1ypnZH1uOI0b/AiBDEpQU/n0PZ7NcBKtA
1lQRymroCUGdx7u6lSwQL7dCRw==
-----END CERTIFICATE-----`,
};


describe('Crypto: Cipher', function () {
    before(function () {
    });
    describe('Cipher', function () {
        const u0pk = cipher.pkFromX509(u0.cert);
        const u0sk = cipher.skFromPem(u0.sk);
        const u1pk = cipher.pkFromX509(u1.cert);
        const u1sk = cipher.skFromPem(u1.sk);
        it('Success', async function () {
            let teststr = 'Hello World';
            let encrypted = cipher.ecdheEncrypt(u0pk, Buffer.from(teststr));
            let decrypted = cipher.ecdheDecrypt(u0sk, encrypted);
            expect(decrypted.toString()).equal(teststr);
            teststr = '';
            encrypted = cipher.ecdheEncrypt(u0pk, Buffer.from(teststr));
            decrypted = cipher.ecdheDecrypt(u0sk, encrypted);
            expect(decrypted.toString()).equal(teststr);
            teststr = 'dsj;sdjsjdfjskfdjskfejwkiopipo we ew jweewjio wej iewjoi we ijoij oewewjio p ';
            encrypted = cipher.ecdheEncrypt(u0pk, Buffer.from(teststr));
            decrypted = cipher.ecdheDecrypt(u0sk, encrypted);
            expect(decrypted.toString()).equal(teststr);
        });

        it('Safety from evil attact', async function () {
            let teststr = 'Hello World';
            let encrypted = cipher.ecdheEncrypt(u0pk, Buffer.from(teststr));
            expect(cipher.ecdheDecrypt.bind(cipher,
                u0sk, encrypted))
                .not.to.throw();

            teststr = 'Hello World';
            encrypted = cipher.ecdheEncrypt(u0pk, Buffer.from(teststr));
            expect(cipher.ecdheDecrypt.bind(cipher, u1sk, encrypted))
                .to.throw();

            teststr = 'Hello World';
            encrypted = cipher.ecdheEncrypt(u0pk, Buffer.from(teststr));
            expect(cipher.ecdheDecrypt.bind(cipher,
                u0sk, Buffer.from('kjldjsdjlksdjklsdjlk;sdjklsjkkkk')))
                .to.throw();
        });
    });
});

