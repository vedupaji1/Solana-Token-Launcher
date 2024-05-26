import { BN } from "bn.js";
import { Liquidity, Token } from "@raydium-io/raydium-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TransactionPriorityLevel } from "./util";
import { makeTxVersion, PROGRAMIDS, feeDestinationId } from "./config";
import {
  buildAndSendTx,
  getWalletTokenAccount,
  addPriorityFeeInTx,
} from "./util";

const ZERO = new BN(0);
type BN = typeof ZERO;

type CalcStartPrice = {
  addBaseAmount: BN;
  addQuoteAmount: BN;
};

type LiquidityPairTargetInfo = {
  baseToken: Token;
  quoteToken: Token;
  targetMarketId: PublicKey;
};

function getMarketAssociatedPoolKeys(input: LiquidityPairTargetInfo) {
  return Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: input.baseToken.mint,
    quoteMint: input.quoteToken.mint,
    baseDecimals: input.baseToken.decimals,
    quoteDecimals: input.quoteToken.decimals,
    marketId: input.targetMarketId,
    programId: PROGRAMIDS.AmmV4,
    marketProgramId: PROGRAMIDS.OPENBOOK_MARKET,
  });
}

type WalletTokenAccounts = Awaited<ReturnType<typeof getWalletTokenAccount>>;

type CreatePoolTxInputInfo = {
  client: Connection;
  txSenderKeyPair: Keypair;
} & LiquidityPairTargetInfo &
  CalcStartPrice & {
    startTime: number; // seconds
    walletTokenAccounts: WalletTokenAccounts;
  } & {
    heliusRPCURL: string;
    txPriorityLevel: TransactionPriorityLevel;
    computeUnitsForPoolCreation: number;
    computeBudgetFee: number;
  };

const ammCreatePool = async (
  txInputInfo: CreatePoolTxInputInfo
): Promise<{ txIds: string[]; poolId: PublicKey; lpMint: PublicKey }> => {
  const initPoolInstructionResponse =
    await Liquidity.makeCreatePoolV4InstructionV2Simple({
      connection: txInputInfo.client,
      programId: PROGRAMIDS.AmmV4,
      marketInfo: {
        marketId: txInputInfo.targetMarketId,
        programId: PROGRAMIDS.OPENBOOK_MARKET,
      },
      baseMintInfo: txInputInfo.baseToken,
      quoteMintInfo: txInputInfo.quoteToken,
      baseAmount: txInputInfo.addBaseAmount,
      quoteAmount: txInputInfo.addQuoteAmount,
      startTime: new BN(Math.floor(txInputInfo.startTime)),
      ownerInfo: {
        feePayer: txInputInfo.txSenderKeyPair.publicKey,
        wallet: txInputInfo.txSenderKeyPair.publicKey,
        tokenAccounts: txInputInfo.walletTokenAccounts,
        useSOLBalance: true,
      },
      associatedOnly: false,
      checkCreateATAOwner: true,
      makeTxVersion,
      feeDestinationId: feeDestinationId,
    });

  console.log(initPoolInstructionResponse.address);
  await addPriorityFeeInTx(
    txInputInfo.heliusRPCURL,
    txInputInfo.txPriorityLevel,
    [txInputInfo.computeUnitsForPoolCreation],
    txInputInfo.computeBudgetFee,
    [PROGRAMIDS.AmmV4.toString()],
    initPoolInstructionResponse.innerTransactions
  );
  return {
    txIds: await buildAndSendTx(
      txInputInfo.client,
      txInputInfo.txSenderKeyPair,
      true,
      initPoolInstructionResponse.innerTransactions
    ),
    poolId: initPoolInstructionResponse.address.ammId,
    lpMint: initPoolInstructionResponse.address.lpMint,
  };
};

type CreatePoolInfoInput = {
  client: Connection;
  txSenderKeyPair: Keypair;
  baseToken: Token;
  quoteToken: Token;
  marketId: PublicKey;
  baseTokenAmountForPoolInit: BN;
  quoteTokenAmountForPoolInit: BN;
  heliusRPCURL: string;
  txPriorityLevel: TransactionPriorityLevel;
  computeUnitsForPoolCreation: number;
  computeBudgetFee: number;
};

export const createPool = async (
  createPoolInfoInput: CreatePoolInfoInput
): Promise<{
  txIds: string[];
  poolId: PublicKey;
  lpMint: PublicKey;
}> => {
  const walletTokenAccounts = await getWalletTokenAccount(
    createPoolInfoInput.client,
    createPoolInfoInput.txSenderKeyPair.publicKey
  );
  const startTime = Math.floor(Math.floor(Date.now() / 1000) + 10);
  const associatedPoolKeys = getMarketAssociatedPoolKeys({
    baseToken: createPoolInfoInput.baseToken,
    quoteToken: createPoolInfoInput.quoteToken,
    targetMarketId: createPoolInfoInput.marketId,
  });

  return await ammCreatePool({
    client: createPoolInfoInput.client,
    txSenderKeyPair: createPoolInfoInput.txSenderKeyPair,
    startTime,
    addBaseAmount: createPoolInfoInput.baseTokenAmountForPoolInit,
    addQuoteAmount: createPoolInfoInput.quoteTokenAmountForPoolInit,
    baseToken: createPoolInfoInput.baseToken,
    quoteToken: createPoolInfoInput.quoteToken,
    targetMarketId: createPoolInfoInput.marketId,
    walletTokenAccounts,
    heliusRPCURL: createPoolInfoInput.heliusRPCURL,
    txPriorityLevel: createPoolInfoInput.txPriorityLevel,
    computeUnitsForPoolCreation:
      createPoolInfoInput.computeUnitsForPoolCreation,
    computeBudgetFee: createPoolInfoInput.computeBudgetFee,
  });
};
