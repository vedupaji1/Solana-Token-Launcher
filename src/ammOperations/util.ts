import {
  buildSimpleTransaction,
  InnerSimpleV0Transaction,
  InstructionType,
  SPL_ACCOUNT_LAYOUT,
  TOKEN_PROGRAM_ID,
  TokenAccount,
} from "@raydium-io/raydium-sdk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Signer,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

import { addLookupTableInfo, makeTxVersion, isMainnet } from "./config";

export async function sendTx(
  connection: Connection,
  payer: Keypair | Signer,
  waitForTxConfirmations: boolean,
  txs: (VersionedTransaction | Transaction)[],
  options?: SendOptions
): Promise<string[]> {
  const txids: string[] = [];
  for (const iTx of txs) {
    if (iTx instanceof VersionedTransaction) {
      iTx.sign([payer]);
      let txId = await connection.sendTransaction(iTx, options);
      if (waitForTxConfirmations == true) {
        let txConfirmRes = await connection.confirmTransaction(
          txId,
          "confirmed"
        );
        if (txConfirmRes.value.err !== null) {
          console.log(txConfirmRes);
          throw new Error(
            "something went wrong when sending transaction, may be transaction have been rejected"
          );
        }
      }
      txids.push(txId);
    } else {
      txids.push(await connection.sendTransaction(iTx, [payer], options));
    }
  }
  return txids;
}

export async function getWalletTokenAccount(
  connection: Connection,
  wallet: PublicKey
): Promise<TokenAccount[]> {
  const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  });
  return walletTokenAccount.value.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}

export async function buildAndSendTx(
  client: Connection,
  txSenderKeyPair: Keypair,
  waitForTxConfirmations: boolean,
  innerSimpleV0Transaction: InnerSimpleV0Transaction[],
  options?: SendOptions
) {
  const willSendTx = await buildSimpleTransaction({
    connection: client,
    makeTxVersion,
    payer: txSenderKeyPair.publicKey,
    innerTransactions: innerSimpleV0Transaction,
    addLookupTableInfo: addLookupTableInfo,
  });
  return await sendTx(
    client,
    txSenderKeyPair,
    waitForTxConfirmations,
    willSendTx,
    options
  );
}

export type TransactionPriorityLevel = "MEDIUM" | "HIGH" | "VERY_HIGH";

export const getEstimatedPriorityFee = async (
  rpcURL: URL,
  priorityLevel: TransactionPriorityLevel,
  programIds: string[]
): Promise<number> => {
  const payload = {
    method: "getPriorityFeeEstimate",
    params: [
      {
        accountKeys: programIds,
        options: {
          priority_level: priorityLevel,
        },
      },
    ],
    id: 1,
    jsonrpc: "2.0",
  };
  const resData = await fetch(rpcURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (resData.ok == false) {
    console.log(resData);
    throw new Error(
      "something went wrong while fetching estimated priority fee"
    );
  }
  let resDataJSON = await resData.json();
  console.log(resDataJSON);
  return resDataJSON.result.priorityFeeEstimate;
};

export const addPriorityFeeInTx = async (
  rpcURL: string,
  priorityLevel: TransactionPriorityLevel,
  computeBudgetLimit: number[],
  computeBudgetFee: number,
  programIds: string[],
  innerInstructions: InnerSimpleV0Transaction[]
): Promise<void> => {
  // Priority Fee For Devnet Transaction
  let priorityFeeEstimate = 100000;
  if (isMainnet == true) {
    if (rpcURL !== "") {
      priorityFeeEstimate = await getEstimatedPriorityFee(
        new URL(rpcURL),
        priorityLevel,
        programIds
      );
    } else if (computeBudgetFee !== 0) {
      priorityFeeEstimate = computeBudgetFee;
    } else {
      throw new Error(
        "helius rpc url and compute budget fee have been not passed"
      );
    }
  } else {
    if (computeBudgetFee !== 0) {
      priorityFeeEstimate = computeBudgetFee;
    }
  }

  console.log("Priority Fee Estimate: ", priorityFeeEstimate);
  let totalInstructions = 1;
  if (isMainnet == true) {
    totalInstructions = innerInstructions.length;
  }
  for (let i = 0; i < totalInstructions; i++) {
    innerInstructions[i].instructions.splice(
      0,
      0,
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeEstimate,
      })
    );
    innerInstructions[i].instructionTypes.splice(
      0,
      0,
      InstructionType.setComputeUnitPrice
    );
    if (computeBudgetLimit[i] !== 0) {
      innerInstructions[i].instructions.splice(
        0,
        0,
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeBudgetLimit[i],
        })
      );
      innerInstructions[i].instructionTypes.splice(
        0,
        0,
        InstructionType.setComputeUnitLimit
      );
    }
  }
};

export async function sleepTime(ms: number) {
  console.log(new Date().toLocaleString(), "sleepTime", ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
