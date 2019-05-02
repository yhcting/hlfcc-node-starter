//////////////////////////////////////////////////////////////////////////////
//
// Golang sample implemneation for communication with ciphered-data
// (Compatible with './cipher.ts')
// Reference:
//   https://github.com/cloudflare/redoctober/blob/3f826eedb692f563514d43f921506324386a98f1/ecdh/ecdh.go
//
//////////////////////////////////////////////////////////////////////////////
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"reflect"

	"golang.org/x/crypto/pbkdf2"
)

var prvPem0 = []byte(`-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDIv/Fwgko0SKNS9M
jLuhZcoj2p3Y48XKdMwF2H+iXfuhRANCAAT2dvcTbb13NsXu0oeTQOzoB9spqrek
5xzPYO8Brd8912gQ2gv+3dk6qsczhCMbvAxAj2OsHkgDq90RmyqNpDH8
-----END PRIVATE KEY-----
`)

var certPem0 = []byte(`-----BEGIN CERTIFICATE-----
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
`)

var prvPem1 = []byte(`-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg8j89OoXCno1UJVG9
MjHMOsVFFskay6VD4tZfyaDJO7ChRANCAASpWIyMIBusi04n/m/ROUYbLWoIR0Go
7fOCmuk/uTJSf3vtmsh/zqOHcbA8JT0ZZCMXrxu0T3n+G6Z6CqJagg25
-----END PRIVATE KEY-----
`)

var certPem1 = []byte(`-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----
`)

// Curve Encryption/Decryption Curve.
var Curve = elliptic.P256

const uncomporessedFormTag = byte(4)
const aesBlockSize = aes.BlockSize

// 32 bytes
const cipherSafeGuard = "CRYPTO-CIPHER-SAFE-GUARD"

func testkey0() *ecdsa.PrivateKey {
	var ok bool
	var err error
	var key interface{}
	var ecprv *ecdsa.PrivateKey
	block, _ := pem.Decode(prvPem0)
	if key, err = x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
		panic(err)
	}
	if ecprv, ok = key.(*ecdsa.PrivateKey); !ok {
		panic(ok)
	}
	return ecprv
}

func testkey1() *ecdsa.PrivateKey {
	var ok bool
	var err error
	var key interface{}
	var ecprv *ecdsa.PrivateKey
	block, _ := pem.Decode(prvPem1)
	if key, err = x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
		panic(err)
	}
	if ecprv, ok = key.(*ecdsa.PrivateKey); !ok {
		panic(ok)
	}
	return ecprv
}

func appends(base []byte, args ...[]byte) []byte {
	x := base
	for _, v := range args {
		x = append(x, v...)
	}
	return x
}

func pkcs5Padding(b []byte, blksz int) []byte {
	padsz := blksz - len(b)%blksz
	padding := bytes.Repeat([]byte{byte(padsz)}, padsz)
	return append(b, padding...)
}

func pkcs5Trimming(b []byte, blksz int) ([]byte, error) {
	padsz := int(b[len(b)-1])
	if padsz > blksz {
		return nil, errors.New("Incorrect padding")
	}
	return b[:len(b)-int(padsz)], nil
}

// MakeRandom is a helper that makes a new buffer full of random data.
func makeRandom(length int) ([]byte, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	return bytes, err
}

func encryptCBC(data, iv, key []byte) (encryptedData []byte, err error) {
	aesCrypt, err := aes.NewCipher(key)
	if err != nil {
		return
	}
	ivBytes := append([]byte{}, iv...)

	encryptedData = make([]byte, len(data))
	aesCBC := cipher.NewCBCEncrypter(aesCrypt, ivBytes)
	aesCBC.CryptBlocks(encryptedData, data)

	return
}

// DecryptCBC decrypt bytes using a key and IV with AES in CBC mode.
func decryptCBC(data, iv, key []byte) (decryptedData []byte, err error) {
	aesCrypt, err := aes.NewCipher(key)
	if err != nil {
		return nil, errors.New("Failed to generate encryption key")
	}
	ivBytes := append([]byte{}, iv...)

	decryptedData = make([]byte, len(data))
	aesCBC := cipher.NewCBCDecrypter(aesCrypt, ivBytes)
	aesCBC.CryptBlocks(decryptedData, data)

	return
}

// Encrypt secures and authenticates its input using the public key
// using ECDHE with AES-128-CBC.
// (HMAC is NOT used. It can be covered by using TLS at GRPC at Fabric.)
func Encrypt(pub *ecdsa.PublicKey, in []byte) (out []byte, err error) {
	ephemeral, err := ecdsa.GenerateKey(Curve(), rand.Reader)
	if err != nil {
		return
	}

	// ephemeral := testkey1()
	ephPub := []byte{uncomporessedFormTag}
	ephPub = append(ephPub, ephemeral.PublicKey.X.Bytes()...)
	ephPub = append(ephPub, ephemeral.PublicKey.Y.Bytes()...)
	x, y := pub.Curve.ScalarMult(pub.X, pub.Y, ephemeral.D.Bytes())
	if x == nil {
		return nil, errors.New("Failed to generate encryption key")
	}

	// ECDH key is NOT used directly for security reason.
	// (See. https://www.rfc-editor.org/rfc/rfc7748.txt)
	// Deriving symmetric cipher key: sha256 of
	// - pubkey(uncompressed) for ecdh-secret
	// - pubkey(uncompressed) of encryptor
	// - pubkey(uncompressed) of decryptor
	keysrc := appends(
		[]byte{uncomporessedFormTag},
		x.Bytes(),
		y.Bytes(),
		ephPub,
		[]byte{uncomporessedFormTag},
		pub.X.Bytes(),
		pub.Y.Bytes())
	fmt.Println(">>> 0")
	fmt.Printf("enX: %#v\n", ephemeral.PublicKey.X.Bytes())
	fmt.Printf("enY: %#v\n", ephemeral.PublicKey.Y.Bytes())
	fmt.Printf("deX: %#v\n", pub.X.Bytes())
	fmt.Printf("deY: %#v\n", pub.Y.Bytes())
	fmt.Printf("ecdh.x: %#v\n", x.Bytes())
	fmt.Printf("ecdh.y: %#v\n", y.Bytes())
	shared := sha256.Sum256(keysrc)
	fmt.Println(">>> 1")
	fmt.Printf("shared: %#v\n", shared)
	iv, err := makeRandom(aesBlockSize)
	if err != nil {
		return
	}
	fmt.Println(">>> 2")
	fmt.Printf("%d\n", len(x.Bytes()))
	fmt.Printf("%d\n", len(x.Bytes()[:aesBlockSize]))
	safeIn := []byte(cipherSafeGuard)
	safeIn = append(safeIn, in...)
	// paddedIn := padding.AddPadding(in)
	paddedIn := pkcs5Padding(safeIn, aesBlockSize)
	fmt.Println(">>> 2")
	fmt.Printf("in: %#v\n", safeIn)
	fmt.Printf("padded: %#v\n", paddedIn)
	fmt.Printf("iv: %#v\n", iv)
	fmt.Printf("shared16: %#v\n", shared[:aesBlockSize])

	ct, err := encryptCBC(paddedIn, iv, shared[:aesBlockSize])
	if err != nil {
		return
	}

	fmt.Println(">>> 3")
	fmt.Printf("ct: %#v\n", ct)

	out = make([]byte, 1+len(ephPub)+aesBlockSize)
	if len(ephPub) > 0xff {
		panic("Invalid key length - too long")
	}
	out[0] = byte(len(ephPub))
	copy(out[1:], ephPub)
	copy(out[1+len(ephPub):], iv)
	out = append(out, ct...)

	return
}

// Decrypt authenticates and recovers the original message from
// its input using the private key and the ephemeral key included in
// the message.
func Decrypt(priv *ecdsa.PrivateKey, in []byte) (out []byte, err error) {
	safeGuard := []byte(cipherSafeGuard)
	ephLen := int(in[0])
	ephPub := in[1 : 1+ephLen]
	iv := in[1+ephLen : 1+ephLen+aesBlockSize]
	ct := in[1+ephLen+aesBlockSize:]
	if len(ct) < aesBlockSize || len(ct) < len(safeGuard) || 1 != ephLen%2 || uncomporessedFormTag != ephPub[0] {
		return nil, errors.New("Invalid ciphertext")
	}

	coordLen := (ephLen - 1) / 2
	enx := new(big.Int)
	enx.SetBytes(ephPub[1 : coordLen+1])
	eny := new(big.Int)
	eny.SetBytes(ephPub[1+coordLen:])

	ok := Curve().IsOnCurve(enx, eny) // Rejects the identity point too.
	if enx == nil || !ok {
		return nil, errors.New("Invalid public key")
	}

	x, y := priv.Curve.ScalarMult(enx, eny, priv.D.Bytes())
	if x == nil {
		return nil, errors.New("Failed to generate encryption key")
	}
	fmt.Println("<<< 0")
	fmt.Printf("enX: %#v\n", enx.Bytes())
	fmt.Printf("enY: %#v\n", eny.Bytes())
	fmt.Printf("deX: %#v\n", priv.PublicKey.X.Bytes())
	fmt.Printf("deY: %#v\n", priv.PublicKey.Y.Bytes())
	fmt.Printf("iv: %#v\n", iv)
	fmt.Printf("ecdh.x: %#v\n", x.Bytes())
	fmt.Printf("ecdh.y: %#v\n", y.Bytes())

	keysrc := appends(
		[]byte{uncomporessedFormTag},
		x.Bytes(),
		y.Bytes(),
		ephPub,
		[]byte{uncomporessedFormTag},
		priv.PublicKey.X.Bytes(),
		priv.PublicKey.Y.Bytes())

	shared := sha256.Sum256(keysrc)
	fmt.Println("<<< 1")
	fmt.Printf("shared: %#v\n", shared)

	paddedOut, err := decryptCBC(ct, iv, shared[:aesBlockSize])
	if err != nil {
		return
	}
	if !bytes.Equal(safeGuard, paddedOut[:len(safeGuard)]) {
		return nil, errors.New("Decryption fails")
	}
	out, err = pkcs5Trimming(paddedOut[len(safeGuard):], aesBlockSize)
	return
}

func ecdheTest() {
	var ok bool
	var err error
	var encrypted []byte
	var key interface{}
	var ecprv *ecdsa.PrivateKey
	block, _ := pem.Decode(prvPem0)
	if key, err = x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
		fmt.Printf("%+v\n", err)
		return
	}
	fmt.Printf("%+v\n", key)
	if ecprv, ok = key.(*ecdsa.PrivateKey); !ok {
		panic(ok)
	}
	ecpub := ecprv.Public().(*ecdsa.PublicKey)

	var ecprv1 *ecdsa.PrivateKey
	block, _ = pem.Decode(prvPem1)
	if key, err = x509.ParsePKCS8PrivateKey(block.Bytes); err != nil {
		fmt.Printf("%+v\n", err)
		return
	}
	fmt.Printf("%+v\n", key)
	if ecprv1, ok = key.(*ecdsa.PrivateKey); !ok {
		panic(ok)
	}

	fmt.Println(reflect.TypeOf(ecprv.X))
	fmt.Printf("%+v\n", ecprv.X)
	fmt.Printf("X:%d, Y:%d, D:%d\n",
		len(ecprv.X.Bytes()),
		len(ecprv.Y.Bytes()),
		len(ecprv.D.Bytes()))
	fmt.Printf("%#v\n", ecprv.X.Bytes())
	fmt.Printf("%#v\n", ecprv.Y.Bytes())
	fmt.Printf("%#v\n", ecprv.D.Bytes())

	teststr := "Hello World"
	if encrypted, err = Encrypt(ecpub, []byte(teststr)); err != nil {
		panic(err)
	}
	fmt.Println("------------------------------------------------------")
	fmt.Printf("%#v\n", encrypted)
	var decrypted []byte
	if decrypted, err = Decrypt(ecprv1, encrypted); err != nil {
		fmt.Println(err)
	} else {
		panic("Evil attack success!")
	}
	if decrypted, err = Decrypt(ecprv, encrypted); err != nil {
		panic(err)
	}

	fmt.Println(string(decrypted))
}

func pbkdf2Test() {
	salt := []byte("salt")
	dk := pbkdf2.Key([]byte("secret"), salt, 13, 32, sha256.New)

	fmt.Printf("DK: %#v\n", dk)
	teststr := "Hello World"
	padded := pkcs5Padding([]byte(teststr), 16)

	sha := sha256.Sum256(salt)
	iv := sha[:16]
	encrypted, _ := encryptCBC(padded, iv, dk)
	decrypted, _ := decryptCBC(encrypted, iv, dk)
	if !bytes.Equal(decrypted, padded) {
		panic("pbkdf2 Fails")
	}
	unpadded, _ := pkcs5Trimming(decrypted, 16)
	if !bytes.Equal([]byte(teststr), unpadded) {
		panic("pbkdf2 Fails")
	}
}

func main() {
	fmt.Println(">>> Hello")
	ecdheTest()
	pbkdf2Test()
}
