import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { BN } from "bn.js";
import * as fs from "fs";
import { swapToken } from "./ammOperations/swapOnlyAmm";
import { getTokenIns } from "./util";
import * as bs58 from "bs58";

(async () => {
  let credentialsFileContent = JSON.parse(
    fs.readFileSync("../config/credentials.json", { encoding: "utf8" })
  );
  let bulkSwapFileContent = JSON.parse(
    fs.readFileSync("../config/bulkSwap.json", { encoding: "utf8" })
  );

  let client = new Connection(credentialsFileContent.rpcURL, "confirmed");
  let tokenInMintAccountPubKey = new PublicKey(bulkSwapFileContent.tokenIn);
  let tokenOutMintAccountPubKey = new PublicKey(bulkSwapFileContent.tokenOut);

  let tokenIn = await getTokenIns(client, tokenInMintAccountPubKey);
  let tokenOut = await getTokenIns(client, tokenOutMintAccountPubKey);
  let totalSwaps = bulkSwapFileContent.txSenders.length;
  console.log("Token-In: ", tokenIn.mint, "\nToken-Out: ", tokenOut.mint);
  console.log("Total Swaps: ", totalSwaps);

  for (let i = 0; i < totalSwaps; i++) {
    let txSenderKeyPair = Keypair.fromSecretKey(
      Uint8Array.from(
        bs58.decode(bulkSwapFileContent.txSenders[i].txSenderPrivateKey)
      )
    );

    console.log(
      "TxSender Address: ",
      txSenderKeyPair.publicKey,
      "\nTxSender Sol Balance: ",
      await client.getBalance(txSenderKeyPair.publicKey)
    );

    console.log(
      `Swap ${i + 1}: `,
      await swapToken({
        client,
        txSenderKeyPair,
        tokenIn,
        tokenOut,
        targetPool: bulkSwapFileContent.poolId,
        tokenInAmount: BigInt(bulkSwapFileContent.txSenders[i].tokenAmountIn),
        heliusRPCURL: bulkSwapFileContent.heliusRPCURL,
        txPriorityLevel: bulkSwapFileContent.txPriorityLevel,
        computeUnitsForSwap: bulkSwapFileContent.computeUnitsForSwap,
        computeBudgetFee: bulkSwapFileContent.computeBudgetFee,
        waitForTxConfirmations: bulkSwapFileContent.waitForTxConfirmations,
      })
    );
  }
})();
