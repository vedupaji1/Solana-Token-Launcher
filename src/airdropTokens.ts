import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";
import * as fs from "fs";
import * as bs58 from "bs58";

(async () => {
  let credentialsFileContent = JSON.parse(
    fs.readFileSync("../config/credentials.json", { encoding: "utf8" })
  );
  let airdropData = JSON.parse(
    fs.readFileSync("../config/airdrop.json", {
      encoding: "utf8",
    })
  );
  let txSenderSecretKey = Uint8Array.from(
    bs58.decode(credentialsFileContent.txSenderPrivateKey)
  );
  let mintAccount = new PublicKey(airdropData.mintAccount);
  let client = new Connection(credentialsFileContent.rpcURL, "confirmed");
  let txSenderKeyPair = Keypair.fromSecretKey(txSenderSecretKey);
  let creatorTokenAccount = getAssociatedTokenAddressSync(
    mintAccount,
    txSenderKeyPair.publicKey,
    false
  );
  console.log(
    "TxSender Address: ",
    txSenderKeyPair.publicKey,
    "\nTxSender Sol Balance: ",
    await client.getBalance(txSenderKeyPair.publicKey),
    "\nTxSender Token Account: ",
    creatorTokenAccount,
    "\nTxSender Token Balance: ",
    (await getAccount(client, creatorTokenAccount)).amount
  );

  let tokenDecimals = (await getMint(client, mintAccount)).decimals;
  let batchSize = airdropData.batchSize;

  let totalUsers = airdropData.operations.length;
  let totalBatches = Math.ceil(totalUsers / batchSize);
  console.log(
    "Total Users: ",
    totalUsers,
    "\nTotal Batches: ",
    totalBatches,
    "\nBatch Size: ",
    batchSize
  );

  for (let i = 0; i < totalBatches; i++) {
    let transaction = new Transaction();
    let nextBatchInitIndex = i * batchSize;
    for (
      let j = nextBatchInitIndex;
      j < nextBatchInitIndex + batchSize && j < totalUsers;
      j++
    ) {
      let receiverAccount = new PublicKey(airdropData.operations[j].address);

      let amount = airdropData.operations[j].amount * 10 ** tokenDecimals;
      let receiverAssociatedTokenAccount = getAssociatedTokenAddressSync(
        mintAccount,
        receiverAccount,
        false
      );
      try {
        await getAccount(client, receiverAssociatedTokenAccount);
        transaction.add(
          createTransferInstruction(
            creatorTokenAccount,
            receiverAssociatedTokenAccount,
            txSenderKeyPair.publicKey,
            amount
          )
        );
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            txSenderKeyPair.publicKey,
            receiverAssociatedTokenAccount,
            receiverAccount,
            mintAccount
          ),
          createTransferInstruction(
            creatorTokenAccount,
            receiverAssociatedTokenAccount,
            txSenderKeyPair.publicKey,
            amount
          )
        );
      }
    }
    console.log(
      await sendAndConfirmTransaction(client, transaction, [txSenderKeyPair])
    );
  }
})();
