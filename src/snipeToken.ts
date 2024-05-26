import {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  TxVersion,
  TokenAmount,
  InstructionType,
} from "@raydium-io/raydium-sdk";
import * as bs58 from "bs58";
import * as fs from "fs";
import { getTokenIns } from "./util";
import {
  getWalletTokenAccount,
  addPriorityFeeInTx,
  buildAndSendTx,
} from "./ammOperations/util";
import { formatAmmKeysById } from "./ammOperations/formatAmmKeysById";

(async () => {
  let credentialsFileContent = JSON.parse(
    fs.readFileSync("../config/credentials.json", { encoding: "utf8" })
  );
  let snipeTokenFileContent = JSON.parse(
    fs.readFileSync("../config/snipeToken.json", { encoding: "utf8" })
  );

  let client = new Connection(credentialsFileContent.rpcURL, "confirmed");
  let tokenIn = await getTokenIns(
    client,
    new PublicKey(snipeTokenFileContent.tokenIn)
  );
  let tokenOut = await getTokenIns(
    client,
    new PublicKey(snipeTokenFileContent.tokenOut)
  );
  let totalSwaps = snipeTokenFileContent.txSenders.length;
  console.log("Token-In: ", tokenIn.mint, "\nToken-Out: ", tokenOut.mint);
  console.log("Total Swaps: ", totalSwaps);

  const poolKeys = jsonInfo2PoolKeys(
    await formatAmmKeysById(client, snipeTokenFileContent.poolId)
  ) as LiquidityPoolKeys;
  console.log(poolKeys);
  let computeBudgetLimit = snipeTokenFileContent.computeUnitsForSwap;
  let priorityFeeEstimate = snipeTokenFileContent.computeBudgetFee;

  if (priorityFeeEstimate == 0) {
    throw new Error("`computeBudgetFee` should not be zero");
  }

  for (let i = 0; i < totalSwaps; i++) {
    let txSenderKeyPair = Keypair.fromSecretKey(
      Uint8Array.from(
        bs58.decode(snipeTokenFileContent.txSenders[i].txSenderPrivateKey)
      )
    );
    console.log("TxSender Address: ", txSenderKeyPair.publicKey);

    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
      connection: client,
      poolKeys,
      userKeys: {
        tokenAccounts: await getWalletTokenAccount(
          client,
          txSenderKeyPair.publicKey
        ),
        owner: txSenderKeyPair.publicKey,
      },
      amountIn: new TokenAmount(
        tokenIn,
        snipeTokenFileContent.txSenders[i].tokenAmountIn
      ),
      amountOut: new TokenAmount(tokenOut, 1),
      fixedSide: "in",
      makeTxVersion: TxVersion.V0,
    });

    innerTransactions[0].instructions.splice(
      0,
      0,
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeEstimate,
      })
    );
    innerTransactions[0].instructionTypes.splice(
      0,
      0,
      InstructionType.setComputeUnitPrice
    );
    if (computeBudgetLimit !== 0) {
      innerTransactions[0].instructions.splice(
        0,
        0,
        ComputeBudgetProgram.setComputeUnitLimit({
          units: computeBudgetLimit,
        })
      );
      innerTransactions[0].instructionTypes.splice(
        0,
        0,
        InstructionType.setComputeUnitLimit
      );
    }
    console.log(
      await buildAndSendTx(client, txSenderKeyPair, false, innerTransactions)
    );
  }
})();
