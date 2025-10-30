#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import * as ed from "@noble/ed25519";
import { Wallet } from "ethers";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type SupportedBlockchain = "Solana" | "Ethereum";

interface WalletSignatureOptions {
  customerId: string;
  blockchain: SupportedBlockchain;
  privateKey?: Uint8Array | string;
  providedAddress?: string;
  verificationDate?: Date;
}

interface WalletSignaturePayload {
  walletAddress: string;
  message: string;
  signature: string;
}

interface CliArguments {
  customerId: string;
  blockchain: string;
  privateKey?: string;
  privateKeyFile?: string;
  address?: string;
  date?: string;
}

function parseSolanaPrivateKey(raw: string): Uint8Array {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error("Solana private key is empty.");
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const parsed = JSON.parse(trimmed) as number[];
    if (!Array.isArray(parsed)) {
      throw new Error("Solana private key JSON must be an array of numbers.");
    }

    return Uint8Array.from(parsed);
  }

  if (/^\d+(,\d+)+$/.test(trimmed)) {
    const segments = trimmed.split(",");
    return Uint8Array.from(
      segments.map((segment) => {
        const value = Number.parseInt(segment, 10);
        if (Number.isNaN(value) || value < 0 || value > 255) {
          throw new Error(`Invalid Solana private key byte value: ${segment}`);
        }
        return value;
      }),
    );
  }

  try {
    return bs58.decode(trimmed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parsing error";
    throw new Error(
      `Failed to decode Solana private key from base58: ${message}`,
    );
  }
}

function loadPrivateKeyFromFile(filePath: string): string {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  try {
    return fs.readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown filesystem error";
    throw new Error(
      `Unable to read private key file at ${resolvedPath}: ${message}`,
    );
  }
}

function formatDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${date.getFullYear()}`;
}

function buildVerificationMessage(
  customerId: string,
  walletAddress: string,
  date: Date,
): string {
  const formattedDate = formatDate(date);
  return `I am verifying ownership of the wallet address ${walletAddress} as customer ${customerId} for UAB Iron Network. This message was signed on ${formattedDate} to confirm my control over this wallet.`;
}

async function deriveSolanaKeyPair(
  privateKey: Uint8Array,
): Promise<{ signingKey: Uint8Array; publicKey: Uint8Array }> {
  const signingKey =
    privateKey.length === 64 ? privateKey.slice(0, 32) : privateKey;

  if (signingKey.length !== 32) {
    throw new Error(
      "Invalid Solana private key length. Expected 32 or 64 bytes.",
    );
  }

  const publicKey = await ed.getPublicKeyAsync(signingKey);

  if (privateKey.length === 64) {
    const embeddedPublicKey = privateKey.slice(32);

    if (!bytesEqual(embeddedPublicKey, publicKey)) {
      throw new Error(
        "Invalid Solana private key: embedded public key does not match the derived public key.",
      );
    }
  }

  return { signingKey, publicKey };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function normalizeEthereumPrivateKey(privateKey: Uint8Array | string): string {
  if (typeof privateKey === "string") {
    const trimmed = privateKey.trim();
    const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

    if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
      throw new Error(
        "Invalid Ethereum private key format. Expected a 32-byte hex string.",
      );
    }

    return prefixed.toLowerCase();
  }

  if (!(privateKey instanceof Uint8Array)) {
    throw new Error("Unexpected private key type.");
  }

  if (privateKey.length !== 32) {
    throw new Error("Invalid Ethereum private key length. Expected 32 bytes.");
  }

  return `0x${Buffer.from(privateKey).toString("hex")}`;
}

function addressesEqual(addressA: string, addressB: string): boolean {
  return addressA.toLowerCase() === addressB.toLowerCase();
}

async function prepareSolanaWallet(
  privateKey: Uint8Array | string | undefined,
  providedAddress: string | undefined,
): Promise<{ signingKey: Uint8Array; walletAddress: string }> {
  if (privateKey !== undefined && !(privateKey instanceof Uint8Array)) {
    throw new Error("Solana private keys must be provided as a Uint8Array.");
  }

  let signingKey: Uint8Array;
  let walletAddress: string;

  if (providedAddress && privateKey instanceof Uint8Array) {
    const keyPair = await deriveSolanaKeyPair(privateKey);
    signingKey = keyPair.signingKey;
    const derivedAddress = bs58.encode(keyPair.publicKey);

    if (derivedAddress !== providedAddress) {
      throw new Error(
        "The provided private key does not match the supplied wallet address.",
      );
    }

    walletAddress = providedAddress;
  } else {
    const basePrivateKey =
      privateKey instanceof Uint8Array
        ? privateKey
        : ed.utils.randomPrivateKey();
    const keyPair = await deriveSolanaKeyPair(basePrivateKey);
    signingKey = keyPair.signingKey;
    walletAddress = bs58.encode(keyPair.publicKey);
  }

  return { signingKey, walletAddress };
}

function prepareEthereumWallet(
  privateKey: Uint8Array | string | undefined,
  providedAddress: string | undefined,
): Wallet {
  if (privateKey !== undefined) {
    const normalizedKey = normalizeEthereumPrivateKey(privateKey);
    const wallet = new Wallet(normalizedKey);

    if (providedAddress && !addressesEqual(wallet.address, providedAddress)) {
      throw new Error(
        "The provided private key does not match the supplied wallet address.",
      );
    }

    return wallet;
  }

  return Wallet.createRandom();
}

async function generateWalletSignature(
  options: WalletSignatureOptions,
): Promise<WalletSignaturePayload> {
  const {
    customerId,
    blockchain,
    privateKey,
    providedAddress,
    verificationDate = new Date(),
  } = options;

  switch (blockchain) {
    case "Solana": {
      const { signingKey, walletAddress } = await prepareSolanaWallet(
        privateKey,
        providedAddress,
      );
      const message = buildVerificationMessage(
        customerId,
        walletAddress,
        verificationDate,
      );
      const signatureBytes = await ed.signAsync(
        new TextEncoder().encode(message),
        signingKey,
      );
      return {
        walletAddress,
        message,
        signature: bs58.encode(signatureBytes),
      };
    }

    case "Ethereum": {
      const wallet = prepareEthereumWallet(privateKey, providedAddress);
      const walletAddress = wallet.address;
      const message = buildVerificationMessage(
        customerId,
        walletAddress,
        verificationDate,
      );
      const signature = await wallet.signMessage(message);
      return {
        walletAddress,
        message,
        signature,
      };
    }

    default:
      throw new Error(
        `Generating signatures for blockchain ${blockchain} is not supported.`,
      );
  }
}

function resolveBlockchain(input: string): SupportedBlockchain {
  const normalized = input.trim().toLowerCase();

  switch (normalized) {
    case "solana":
      return "Solana";
    case "ethereum":
      return "Ethereum";
    default:
      throw new Error(
        `Unsupported blockchain "${input}". Use "solana" or "ethereum".`,
      );
  }
}

async function main(): Promise<void> {
  const argv = yargs(hideBin(process.argv))
    .usage(
      "Usage: pnpm tsx scripts/wallet-signature.ts --customer-id <id> [options]",
    )
    .option("customer-id", {
      type: "string",
      demandOption: true,
      describe: "Customer identifier used in the verification message",
    })
    .option("blockchain", {
      type: "string",
      choices: ["solana", "ethereum"],
      default: "solana",
      describe: "Target blockchain",
    })
    .option("private-key", {
      type: "string",
      describe: "Private key as a string (base58 for Solana, hex for Ethereum)",
    })
    .option("private-key-file", {
      type: "string",
      describe:
        "Path to a file containing the private key (JSON array or base58 for Solana, hex for Ethereum)",
    })
    .option("address", {
      type: "string",
      describe:
        "Existing wallet address to validate against the provided private key",
    })
    .option("date", {
      type: "string",
      describe:
        "Verification date (ISO format). Defaults to the current date if omitted.",
    })
    .help()
    .strict()
    .parseSync() as CliArguments;

  const blockchain = resolveBlockchain(argv.blockchain);

  const privateKeyInput =
    argv.privateKeyFile !== undefined
      ? loadPrivateKeyFromFile(argv.privateKeyFile)
      : argv.privateKey;

  let privateKey: WalletSignatureOptions["privateKey"] = undefined;

  if (privateKeyInput !== undefined) {
    if (blockchain === "Solana") {
      privateKey = parseSolanaPrivateKey(privateKeyInput);
    } else {
      privateKey = privateKeyInput;
    }
  }

  let verificationDate: Date | undefined;

  if (argv.date) {
    const parsed = new Date(argv.date);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(
        `Unable to parse verification date "${argv.date}". Expected ISO format (e.g. 2024-02-29).`,
      );
    }
    verificationDate = parsed;
  }

  const result = await generateWalletSignature({
    customerId: argv.customerId,
    blockchain,
    privateKey,
    providedAddress: argv.address,
    verificationDate,
  });

  console.log(
    JSON.stringify(
      {
        blockchain,
        walletAddress: result.walletAddress,
        message: result.message,
        signature: result.signature,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  console.error(message);
  process.exitCode = 1;
});
