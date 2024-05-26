import {
  percentAmount,
  generateSigner,
  signerIdentity,
  createSignerFromKeypair,
} from "@metaplex-foundation/umi";
import {
  TokenStandard,
  createAndMint,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  AuthorityType,
  createSetAuthorityInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCandyMachine } from "@metaplex-foundation/mpl-candy-machine";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import pinataSDK from "@pinata/sdk";
import * as fs from "fs";
import path from "path";
import * as bs58 from "bs58";

const storeNFTMetadata = async (
  credentialsFileContent: any
): Promise<{ metaDataURL: string; tokenInfo: any }> => {
  let pinataJWT = credentialsFileContent.pinataJWTToken;
  let tokenData = JSON.parse(
    fs.readFileSync("../config/tokenData.json", { encoding: "utf8" })
  );
  let pinata = new pinataSDK({ pinataJWTKey: pinataJWT });
  let imageURL: string;
  if (tokenData.imageURL == "") {
    if (tokenData.imageLocalPath == "") {
      throw new Error("image path or url must be specified");
    }
    const fileReadStream = fs.createReadStream(tokenData.imageLocalPath);
    let imageUploadResData = await pinata.pinFileToIPFS(fileReadStream, {
      pinataMetadata: {
        name: tokenData.name + "_" + path.basename(tokenData.imageLocalPath),
      },
    });
    imageURL =
      "https://emerald-leading-quokka-926.mypinata.cloud/ipfs/" +
      imageUploadResData.IpfsHash;
    console.log("Image Uploaded On IPFS: ", imageURL);
  } else {
    imageURL = tokenData.imageURL;
  }
  let tokenMetaData = {
    name: tokenData.name,
    symbol: tokenData.symbol,
    description: tokenData.description,
    image: imageURL,
  };
  let metaDataUploadResData = await pinata.pinJSONToIPFS(tokenMetaData, {
    pinataMetadata: {
      name: path.basename(tokenData.name + "_metadata.json"),
    },
  });
  let metaDataURL =
    "https://emerald-leading-quokka-926.mypinata.cloud/ipfs/" +
    metaDataUploadResData.IpfsHash;
  console.log("MetaData Uploaded On IPFS: ", metaDataURL);
  return { metaDataURL: metaDataURL, tokenInfo: tokenData };
};

(async () => {
  let credentialsFileContent = JSON.parse(
    fs.readFileSync("../config/credentials.json", { encoding: "utf8" })
  );
  let txSenderSecretKey = Uint8Array.from(
    bs58.decode(credentialsFileContent.txSenderPrivateKey)
  );

  let tokenData = await storeNFTMetadata(credentialsFileContent);
  let client = new Connection(credentialsFileContent.rpcURL, "confirmed");
  let txSenderKeyPair = Keypair.fromSecretKey(txSenderSecretKey);
  console.log(
    "TxSender Address: ",
    txSenderKeyPair.publicKey,
    " \nTxSender Sol Balance: ",
    await client.getBalance(txSenderKeyPair.publicKey)
  );

  let umi = createUmi(credentialsFileContent.rpcURL);
  const userWallet = umi.eddsa.createKeypairFromSecretKey(txSenderSecretKey);
  const userWalletSigner = createSignerFromKeypair(umi, userWallet);

  const mintAccount = generateSigner(umi);
  console.log("Token Account: ", mintAccount.publicKey);
  console.log(
    "MetaData Account",
    findMetadataPda(umi, {
      mint: mintAccount.publicKey,
    })
  );

  umi.use(signerIdentity(userWalletSigner));
  umi.use(mplCandyMachine());

  console.log(
    (
      await createAndMint(umi, {
        mint: mintAccount,
        authority: umi.identity,
        name: tokenData.tokenInfo.name,
        symbol: tokenData.tokenInfo.symbol,
        uri: tokenData.metaDataURL,
        sellerFeeBasisPoints: percentAmount(0),
        decimals: tokenData.tokenInfo.decimals,
        amount: BigInt(tokenData.tokenInfo.totalSupply),
        tokenOwner: userWallet.publicKey,
        tokenStandard: TokenStandard.Fungible,
        isMutable: false,
      }).sendAndConfirm(umi)
    ).result
  );

  const transaction = new Transaction().add(
    createSetAuthorityInstruction(
      new PublicKey(mintAccount.publicKey.toString()),
      txSenderKeyPair.publicKey,
      AuthorityType.MintTokens,
      null,
      [],
      TOKEN_PROGRAM_ID
    ),
    createSetAuthorityInstruction(
      new PublicKey(mintAccount.publicKey.toString()),
      txSenderKeyPair.publicKey,
      AuthorityType.FreezeAccount,
      null,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  console.log(
    await sendAndConfirmTransaction(client, transaction, [txSenderKeyPair])
  );
})();
