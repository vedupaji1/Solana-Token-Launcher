import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  burn,
} from "@solana/spl-token";
import { BN } from "bn.js";
import * as fs from "fs";
import * as bs58 from "bs58";
import { createMarket } from "./ammOperations/createMarket";
import { getTokenIns } from "./util";
import { createPool } from "./ammOperations/ammCreatePool";
import { sleepTime } from "./ammOperations/util";

(async () => {
  let credentialsFileContent = JSON.parse(
    fs.readFileSync("../config/credentials.json", { encoding: "utf8" })
  );
  let tokenLaunchFileContent = JSON.parse(
    fs.readFileSync("../config/launchToken.json", { encoding: "utf8" })
  );

  let txSenderKeyPair = Keypair.fromSecretKey(
    Uint8Array.from(bs58.decode(credentialsFileContent.txSenderPrivateKey))
  );
  let client = new Connection(credentialsFileContent.rpcURL, "confirmed");
  let baseTokenMintAccountPubKey = new PublicKey(
    tokenLaunchFileContent.baseToken
  );
  let quoteTokenMintAccountPubKey = new PublicKey(
    tokenLaunchFileContent.quoteToken
  );
  let txSenderBaseTokenAccount = getAssociatedTokenAddressSync(
    baseTokenMintAccountPubKey,
    txSenderKeyPair.publicKey,
    false
  );

  console.log(
    "TxSender Address: ",
    txSenderKeyPair.publicKey,
    "\nTxSender Sol Balance: ",
    await client.getBalance(txSenderKeyPair.publicKey),
    "\nTxSender Base Token Account: ",
    txSenderBaseTokenAccount,
    "\nTxSender Base Token Balance: ",
    (await getAccount(client, txSenderBaseTokenAccount)).amount
  );

  let baseToken = await getTokenIns(client, baseTokenMintAccountPubKey);
  let quoteToken = await getTokenIns(client, quoteTokenMintAccountPubKey);

  let createMarketResData = await createMarket({
    client,
    txSenderKeyPair,
    baseToken,
    quoteToken,
    lotSize: tokenLaunchFileContent.lotSize,
    tickSize: tokenLaunchFileContent.tickSize,
    heliusRPCURL: tokenLaunchFileContent.heliusRPCURL,
    txPriorityLevel: tokenLaunchFileContent.txPriorityLevel,
    computeUnitsForMarketAccountCreation:
      tokenLaunchFileContent.computeUnitsForMarketAccountCreation,
    computeUnitsForMarketInit: tokenLaunchFileContent.computeUnitsForMarketInit,
    computeBudgetFee: tokenLaunchFileContent.computeBudgetFee,
  });
  console.log("Waiting For Market To Be Created");
  // await sleepTime(60000);
  console.log("Market Created: ", createMarketResData);

  // Double Check For Transaction Status
  for (let i = 0; i < 2; i++) {
    let createMarketTxRes = await client.getSignatureStatus(
      createMarketResData.txIds[i],
      {
        searchTransactionHistory: true,
      }
    );
    if (createMarketTxRes.value?.err !== null) {
      console.log(createMarketTxRes);
      throw new Error("Something Went Wrong, Any Transaction Got Failed");
    }
  }

  const baseTokenAmountForPoolInit = new BN(
    tokenLaunchFileContent.baseTokenAmountForPoolInit
  );
  const quoteTokenAmountForPoolInit = new BN(
    tokenLaunchFileContent.quoteTokenAmountForPoolInit
  );
  let createPoolResData = await createPool({
    client,
    txSenderKeyPair,
    baseToken,
    quoteToken,
    marketId: createMarketResData.marketId,
    baseTokenAmountForPoolInit,
    quoteTokenAmountForPoolInit,
    heliusRPCURL: tokenLaunchFileContent.heliusRPCURL,
    txPriorityLevel: tokenLaunchFileContent.txPriorityLevel,
    computeUnitsForPoolCreation:
      tokenLaunchFileContent.computeUnitsForPoolCreation,
    computeBudgetFee: tokenLaunchFileContent.computeBudgetFee,
  });
  console.log("Waiting For Pool To Be Created");
  // await sleepTime(60000);
  console.log("Pool Created: ", createPoolResData);

  let createPoolTxRes = await client.getSignatureStatus(
    createPoolResData.txIds[0],
    {
      searchTransactionHistory: true,
    }
  );
  if (createPoolTxRes.value?.err !== null) {
    console.log(createPoolTxRes);
    throw new Error("Something Went Wrong, Any Transaction Got Failed");
  }

  let liquidityDepositorLPTokenAccount = getAssociatedTokenAddressSync(
    createPoolResData.lpMint,
    txSenderKeyPair.publicKey,
    false
  );
  console.log(
    await burn(
      client,
      txSenderKeyPair,
      liquidityDepositorLPTokenAccount,
      createPoolResData.lpMint,
      txSenderKeyPair.publicKey,
      (
        await getAccount(client, liquidityDepositorLPTokenAccount)
      ).amount
    )
  );
  console.log("LP Token Burned");
})();
