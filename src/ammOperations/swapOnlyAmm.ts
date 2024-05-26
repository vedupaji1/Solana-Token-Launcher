import assert from "assert";
import {
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { makeTxVersion } from "./config";
import { formatAmmKeysById } from "./formatAmmKeysById";
import {
  buildAndSendTx,
  getWalletTokenAccount,
  TransactionPriorityLevel,
  addPriorityFeeInTx,
} from "./util";

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>;
type SwapTokenTxInputInfo = {
  client: Connection;
  txSenderKeyPair: Keypair;
  outputToken: Token;
  targetPool: string;
  inputTokenAmount: TokenAmount;
  slippage: Percent;
  walletTokenAccounts: WalletTokenAccounts;
  heliusRPCURL: string;
  txPriorityLevel: TransactionPriorityLevel;
  computeUnitsForSwap: number;
  computeBudgetFee: number;
  waitForTxConfirmations:boolean;
};

async function swapOnlyAmm(txInputInfo: SwapTokenTxInputInfo) {
  const targetPoolInfo = await formatAmmKeysById(
    txInputInfo.client,
    txInputInfo.targetPool
  );
  assert(targetPoolInfo, "cannot find the target pool");
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

  const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: await Liquidity.fetchInfo({
      connection: txInputInfo.client,
      poolKeys,
    }),
    amountIn: txInputInfo.inputTokenAmount,
    currencyOut: txInputInfo.outputToken,
    slippage: txInputInfo.slippage,
  });

  const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
    connection: txInputInfo.client,
    poolKeys,
    userKeys: {
      tokenAccounts: txInputInfo.walletTokenAccounts,
      owner: txInputInfo.txSenderKeyPair.publicKey,
    },
    amountIn: txInputInfo.inputTokenAmount,
    amountOut: minAmountOut,
    fixedSide: "in",
    makeTxVersion,
  });


  console.log(
    "amountOut:",
    amountOut.toFixed(),
    "  minAmountOut: ",
    minAmountOut.toFixed()
  );
  await addPriorityFeeInTx(
    txInputInfo.heliusRPCURL,
    txInputInfo.txPriorityLevel,
    [txInputInfo.computeUnitsForSwap],
    txInputInfo.computeBudgetFee,
    [txInputInfo.targetPool.toString()],
    innerTransactions
  );
  return {
    txIds: await buildAndSendTx(
      txInputInfo.client,
      txInputInfo.txSenderKeyPair,
      txInputInfo.waitForTxConfirmations,
      innerTransactions,
    ),
  };
}

type SwapTokenInfoInput = {
  client: Connection;
  txSenderKeyPair: Keypair;
  tokenIn: Token;
  tokenOut: Token;
  targetPool: string;
  tokenInAmount: bigint;
  heliusRPCURL: string;
  txPriorityLevel: TransactionPriorityLevel;
  computeUnitsForSwap: number;
  computeBudgetFee: number;
  waitForTxConfirmations:boolean;
};

export const swapToken = async (
  swapTokenInfoInput: SwapTokenInfoInput
): Promise<{
  txIds: string[];
}> => {
  const inputTokenAmount = new TokenAmount(
    swapTokenInfoInput.tokenIn,
    swapTokenInfoInput.tokenInAmount
  );
  const slippage = new Percent(100, 100);
  const walletTokenAccounts = await getWalletTokenAccount(
    swapTokenInfoInput.client,
    swapTokenInfoInput.txSenderKeyPair.publicKey
  );
  return await swapOnlyAmm({
    client: swapTokenInfoInput.client,
    txSenderKeyPair: swapTokenInfoInput.txSenderKeyPair,
    outputToken: swapTokenInfoInput.tokenOut,
    targetPool: swapTokenInfoInput.targetPool,
    inputTokenAmount,
    slippage,
    walletTokenAccounts,
    heliusRPCURL: swapTokenInfoInput.heliusRPCURL,
    txPriorityLevel: swapTokenInfoInput.txPriorityLevel,
    computeUnitsForSwap: swapTokenInfoInput.computeUnitsForSwap,
    computeBudgetFee: swapTokenInfoInput.computeBudgetFee,
    waitForTxConfirmations:swapTokenInfoInput.waitForTxConfirmations
  });
};
