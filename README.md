## Introduction
This is template to start developing Chaincode(Typescript) of Hyperledger Fabric(henceforth HLF) **v1.2.x** for NodeJs with Visual-Studio-Code. Developer may be able to refer sample practices from *src/chaincode.ts*.

This template has following modules.
### stubex
This is helper to use Stub interface of *fabric-shim*.<br>
In HLF, reading and writing global state are expensive operations. And by design, reading state that is updated in current transaction gives *original* - before updating - value. Developer can overcome these constraints by using *stubex*.

### mock
This is very simple mock - but very premature yet - of *fabric-shim* to test Chaincode. Running Chaincode requires HLF network. But by using mock, developer can test and debug Chaincode easily.

### crypto
This has following helper functions.
- Reading private/public key from X509 certificate of HLF.
- Encryption/Decryption with ECDSA key of HLF by using AES-128 or ECDHE. And it's *golang* counter-part(See *src/crypto/sample.go*)

## Release Chaincode
Follow below steps to release your project as HLF Chaincode.
1. npm run dist
2. release *dist/* directory.
HLF executes *npm install* and *npm start* at released proejct directory to run NodeJs-Chaincode in network. That the reaon why *npm start* executes *index.js* not *build/index.js* for *dist/index.js*.