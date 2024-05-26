import {
  ENDPOINT as _ENDPOINT,
  LOOKUP_TABLE_CACHE,
  DEVNET_PROGRAM_ID,
  MAINNET_PROGRAM_ID,
  TxVersion,
} from "@raydium-io/raydium-sdk";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";

let credentialsFileContent = JSON.parse(
  fs.readFileSync("../config/credentials.json", { encoding: "utf8" })
);

export const isMainnet = credentialsFileContent.isMainnet;

export const PROGRAMIDS =
  isMainnet === true ? MAINNET_PROGRAM_ID : DEVNET_PROGRAM_ID;

export const addLookupTableInfo =
  isMainnet === true ? LOOKUP_TABLE_CACHE : undefined;

export const makeTxVersion = TxVersion.V0;

export const feeDestinationId =
  isMainnet === true
    ? new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5")
    : new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR");
