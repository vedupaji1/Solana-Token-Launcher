import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as bs58 from "bs58";
import { formatAmmKeysById } from "./ammOperations/formatAmmKeysById";
import {
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import { BN } from "bn.js";
import { getTokenIns } from "./util";

(async () => {
  let credentialsFileContent = JSON.parse(
    fs.readFileSync("../config/credentials.json", { encoding: "utf8" })
  );
  let tokenOutInAMMFileContent = JSON.parse(
    fs.readFileSync("../config/tokenOutInAMM.json", { encoding: "utf8" })
  );

  let client = new Connection(credentialsFileContent.rpcURL, "confirmed");
  let tokenInMintAccountPubKey = new PublicKey(
    tokenOutInAMMFileContent.tokenIn
  );
  let tokenOutMintAccountPubKey = new PublicKey(
    tokenOutInAMMFileContent.tokenOut
  );

  let tokenIn = await getTokenIns(client, tokenInMintAccountPubKey);
  let tokenOut = await getTokenIns(client, tokenOutMintAccountPubKey);
  console.log("Token-In: ", tokenIn.mint, "\nToken-Out: ", tokenOut.mint);

  let poolKeys = jsonInfo2PoolKeys(
    await formatAmmKeysById(client, tokenOutInAMMFileContent.poolId)
  ) as LiquidityPoolKeys;
  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: await Liquidity.fetchInfo({
      connection: client,
      poolKeys,
    }),
    amountIn: new TokenAmount(
      tokenIn,
      new BN(tokenOutInAMMFileContent.amountIn)
    ),
    currencyOut: tokenOut,
    slippage: new Percent(20, 100),
  });
  console.log(
    "Amount-In: ",
    tokenOutInAMMFileContent.amountIn,
    "\nAmount-Out: ",
    amountOut.toFixed(),
    "\nMinAmount-Out: ",
    minAmountOut.toFixed()
  );
})();
