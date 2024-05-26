import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  findMetadataPda,
  fetchMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { Token, TOKEN_PROGRAM_ID } from "@raydium-io/raydium-sdk";

export const getTokenIns = async (
  client: Connection,
  mintAccount: PublicKey
): Promise<Token> => {
  let umi = createUmi(client.rpcEndpoint);
  let tokenMetaData = await fetchMetadata(
    umi,
    findMetadataPda(umi, {
      mint: publicKey(mintAccount),
    })
  );
  return new Token(
    TOKEN_PROGRAM_ID,
    mintAccount,
    (await getMint(client, mintAccount)).decimals,
    tokenMetaData.symbol,
    tokenMetaData.name
  );
};
