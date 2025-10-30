# Signature Example

This is a TypeScript NodeJS example that shows how to calculate the signature for registering a self-hosted wallet using the [https://docs.iron.xyz/reference/registerselfhostedwalletaddress-1](IRON api).

## Installation

```sh
# pnpm
pnpm install

# npm
npm install
```

## Invocation

You will need the customer id, the blockchain, and a private key for the blockchain. For Solana, the private key can be in the Solana array format: `[48, 60, ...]`:

### Solana

```sh
pnpm tsx scripts/wallet-signature.ts \
  --customer-id 0199b8ad-59df-7021-99bc-2f14b29df98c \
  --blockchain solana --private-key \
  "[48,60,13,171,160,125,32,216,174,247,207,196,130,43,90,67,76,144,27,181,229,35,212,132,34,125,136,228,91,62,18,91,23,92,36,127,197,117,30,136,94,35,111,153,183,5,230,8,201,129,33,61,119,95,57,159,191,136,180,94,8,54,100,55]"
```

The customer id is being used to prepare the signature string. E.g. in the example above, the script will generate this message:

> I am verifying ownership of the wallet address 2aBsNKwhXvafriEZjv2gXaivVjjS1SxgVhfh4uLmTPgS as customer 0199b8ad-59df-7021-99bc-2f14b29df98c for UAB Iron Network. This message was signed on 30/10/2025 to confirm my control over this wallet.

The full response will look like this:

```json
{
  "blockchain": "Solana",
  "walletAddress": "2aBsNKwhXvafriEZjv2gXaivVjjS1SxgVhfh4uLmTPgS",
  "message": "I am verifying ownership of the wallet address 2aBsNKwhXvafriEZjv2gXaivVjjS1SxgVhfh4uLmTPgS as customer 0199b8ad-59df-7021-99bc-2f14b29df98c for UAB Iron Network. This message was signed on 30/10/2025 to confirm my control over this wallet.",
  "signature": "4eiCZudNL9nTWKCUHMWQBnjbDEB3cSo72SKCg8KPo5iFb8faDCx2ew4ciyPxJJABnTHJwXVy1HBeJ2eoZyTC8zP5"
}
```

### Ethereum

```sh
pnpm tsx scripts/wallet-signature.ts \
  --customer-id 0199b8ad-59df-7021-99bc-2f14b29df98c \
  --blockchain ethereum \
  --private-key 67de2dfb4b8bc45089581d0faef9e4bf6a474976317523a99813913ce8b56ed9
```

The full response will look like this:

```json
{
  "blockchain": "Ethereum",
  "walletAddress": "0x109f0f768EBFAE6E3CE0D8c35e21C69625478cf5",
  "message": "I am verifying ownership of the wallet address 0x109f0f768EBFAE6E3CE0D8c35e21C69625478cf5 as customer 0199b8ad-59df-7021-99bc-2f14b29df98c for UAB Iron Network. This message was signed on 30/10/2025 to confirm my control over this wallet.",
  "signature": "0xeef551e2e054d1c07f686b6ac6a7a221cb05709e148d8d99b0a637d41620bbce66115a23d6c098e7905e3352c945a3a274a6c5799360572392730dd2ea3f59971b"
}
```
