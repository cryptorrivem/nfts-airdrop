const fs = require("fs");
const {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createCloseAccountInstruction,
} = require("@solana/spl-token");
const { PromisePool } = require("@supercharge/promise-pool");
const {
  PublicKey,
  Keypair,
  Connection,
  clusterApiUrl,
  Transaction,
} = require("@solana/web3.js");
const { SingleBar, Presets } = require("cli-progress");

function createConnection({ env, rpc }) {
  const connection = new Connection(rpc || clusterApiUrl(env), {
    commitment: "processed",
    confirmTransactionInitialTimeout: 90000,
  });
  return connection;
}

function getWallet(keypair) {
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair, "utf-8")))
  );
  return wallet;
}

function getMintWhitelist(whitelistFile) {
  if (whitelistFile === "ANY") {
    return null;
  }
  return JSON.parse(fs.readFileSync(whitelistFile, "utf-8"));
}

async function getWalletMints({ connection, publicKey, mintWhitelist = null }) {
  const { value: tokenAccounts } =
    await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: TOKEN_PROGRAM_ID,
    });
  const mints = tokenAccounts
    .filter((t) => t.account.data.parsed.info.tokenAmount.uiAmount === 1)
    .map((t) => t.account.data.parsed.info.mint);

  if (!mintWhitelist) {
    return mints;
  }
  return mints.filter((m) => mintWhitelist.includes(m));
}

function batch(array, size) {
  let result = [];
  while (array.length > 0) {
    result = [...result, array.slice(0, size)];
    array = array.slice(size);
  }
  return result;
}

async function sendMints({
  connection,
  wallet,
  pairs,
  bundleSize = 6,
  concurrency = 5,
}) {
  console.info(
    "Sending",
    pairs.length,
    "mints from",
    wallet.publicKey.toBase58()
  );
  const chunks = batch(pairs, bundleSize);

  const bar = new SingleBar({}, Presets.shades_classic);
  bar.start(chunks.length, 0);

  const { results, errors } = await PromisePool.withConcurrency(concurrency)
    .for(chunks)
    .process(async (chunk) => {
      const chunkPubkey = chunk.map(({ mint, destination }) => ({
        mint: new PublicKey(mint),
        destination: new PublicKey(destination),
      }));
      const fromTokenAccounts = await Promise.all(
        chunkPubkey.map((c) =>
          getAssociatedTokenAddress(c.mint, wallet.publicKey)
        )
      );
      const toTokenAccounts = await Promise.all(
        chunkPubkey.map((c) => getAssociatedTokenAddress(c.mint, c.destination))
      );
      const existsToTokenAccounts = await connection.getMultipleAccountsInfo(
        toTokenAccounts
      );

      const instructions = fromTokenAccounts.reduce(
        (res, fromTokenAccount, ix) => {
          let instructions = [];
          if (!existsToTokenAccounts[ix]) {
            instructions.push(
              createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                toTokenAccounts[ix],
                chunkPubkey[ix].destination,
                chunkPubkey[ix].mint
              )
            );
          }
          instructions.push(
            createTransferInstruction(
              fromTokenAccount,
              toTokenAccounts[ix],
              wallet.publicKey,
              1
            )
          );

          instructions.push(
            createCloseAccountInstruction(
              fromTokenAccount,
              wallet.publicKey,
              wallet.publicKey
            )
          );

          return [...res, ...instructions];
        },
        []
      );

      const transaction = new Transaction();
      await transaction.add(...instructions);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      const signature = await connection.sendTransaction(transaction, [wallet]);

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });
      bar.increment();

      return `Signature: ${signature}\n${chunk
        .map((c) => `Mint: ${c.mint} => To: ${c.destination}`)
        .join("\n")}`;
    });

  bar.stop();

  console.info("Results:\n");
  console.info(results.join("\n\n"));
  console.info();
  console.info(
    "Errors:\n",
    errors
      .map(
        (e) =>
          `${e.raw}\n${e.item
            .map((c) => `Mint: ${c.mint} => To: ${c.destination}`)
            .join("\n")}`
      )
      .join("\n\n")
  );
}

module.exports = {
  createConnection,
  getWallet,
  getMintWhitelist,
  getWalletMints,
  sendMints,
};
