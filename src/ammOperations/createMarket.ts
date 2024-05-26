import { MarketV2, Token } from "@raydium-io/raydium-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { makeTxVersion, PROGRAMIDS } from "./config";
import {
  buildAndSendTx,
  addPriorityFeeInTx,
  TransactionPriorityLevel,
} from "./util";

type CreateMarketTxInputInfo = {
  client: Connection;
  txSenderKeyPair: Keypair;
  baseToken: Token;
  quoteToken: Token;
  lotSize: number;
  tickSize: number;
  heliusRPCURL: string;
  txPriorityLevel: TransactionPriorityLevel;
  computeUnitsForMarketAccountCreation: number;
  computeUnitsForMarketInit: number;
  computeBudgetFee: number;
};

export async function createMarket(txInputInfo: CreateMarketTxInputInfo) {
  const createMarketInstruments =
    await MarketV2.makeCreateMarketInstructionSimple({
      connection: txInputInfo.client,
      wallet: txInputInfo.txSenderKeyPair.publicKey,
      baseInfo: txInputInfo.baseToken,
      quoteInfo: txInputInfo.quoteToken,
      lotSize: txInputInfo.lotSize, // default 1
      tickSize: txInputInfo.tickSize, // default 0.01
      dexProgramId: PROGRAMIDS.OPENBOOK_MARKET,
      makeTxVersion,
    });
  console.log(createMarketInstruments.address);

  await addPriorityFeeInTx(
    txInputInfo.heliusRPCURL,
    txInputInfo.txPriorityLevel,
    [
      txInputInfo.computeUnitsForMarketAccountCreation,
      txInputInfo.computeUnitsForMarketInit,
    ],
    txInputInfo.computeBudgetFee,
    [PROGRAMIDS.OPENBOOK_MARKET.toString()],
    createMarketInstruments.innerTransactions
  );
  return {
    txIds: await buildAndSendTx(
      txInputInfo.client,
      txInputInfo.txSenderKeyPair,
      true,
      createMarketInstruments.innerTransactions,
      {
        skipPreflight: true,
        maxRetries: 10,
      }
    ),
    marketId: createMarketInstruments.address.marketId,
  };
}
