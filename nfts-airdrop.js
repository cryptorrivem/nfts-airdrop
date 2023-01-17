const { program } = require("commander");
const { TSV, CSV } = require("tsv");
const fs = require("fs");
const {
  getWalletMints,
  getMintWhitelist,
  sendMints,
  createConnection,
  getWallet,
} = require("./tools");

program
  .name("nfts-airdrop")
  .description("CLI to send NFTs to multiple wallets")
  .version("0.0.1");

program
  .command("send-to-one-wallet")
  .requiredOption("-e, --env <string>", "environment")
  .requiredOption(
    "-k, --keypair <path>",
    "keypair for wallet holding the nfts to send"
  )
  .option("-r, --rpc <string>", "rpc to use")
  .requiredOption(
    "-d, --destination <string>",
    "wallet that will receive the nfts"
  )
  .requiredOption("-n, --number <int>", "amount of nfts to send to destination")
  .requiredOption(
    "-w, --whitelist <string>",
    "path to a json list of whitelisted mints of nfts to be send or `ANY` to pick send a random nft from the wallet"
  )
  .option(
    "-b, --bundle-size <int>",
    "mints bundled per transaction, max is 6",
    6
  )
  .option("-c, --concurrency <int>", "number of parallel transactions", 5)
  .action(
    async ({
      env,
      keypair,
      rpc,
      destination,
      number,
      whitelist,
      bundleSize,
      concurrency,
    }) => {
      const connection = createConnection({ env, rpc });
      const wallet = getWallet(keypair);
      const mintWhitelist = getMintWhitelist(whitelist);
      const walletMints = await getWalletMints({
        connection,
        publicKey: wallet.publicKey,
        mintWhitelist,
      });

      const pairs = walletMints.slice(0, parseInt(number)).map((mint) => ({
        destination,
        mint,
      }));

      await sendMints({
        connection,
        wallet,
        pairs,
        bundleSize: parseInt(bundleSize),
        concurrency: parseInt(concurrency),
      });

      process.exit(0);
    }
  );

program
  .command("send-to-many-wallets")
  .requiredOption("-e, --env <string>", "environment")
  .requiredOption(
    "-k, --keypair <path>",
    "keypair for wallet holding the nfts to send"
  )
  .option("-r, --rpc <string>", "rpc to use")
  .requiredOption(
    "-l, --list <path>",
    "csv or tsv file containing <mint,destination> to send specific nft to specific destination"
  )
  .option(
    "-b, --bundle-size <int>",
    "mints bundled per transaction, max is 6",
    6
  )
  .option("-c, --concurrency <int>", "number of parallel transactions", 5)
  .option(
    "-s, --skip-missing-mints",
    "skip missing mints in keypair wallet (useful for retries)"
  )
  .action(
    async ({
      env,
      keypair,
      rpc,
      list,
      bundleSize,
      concurrency,
      skipMissingMints,
    }) => {
      const connection = createConnection({ env, rpc });
      const wallet = getWallet(keypair);

      let pairs = fs.readFileSync(list, "utf-8");
      if (list.endsWith(".tsv")) {
        pairs = TSV.parse(pairs);
      } else if (list.endsWith(".csv")) {
        pairs = CSV.parse(pairs);
      } else if (list.endsWith(".json")) {
        pairs = JSON.parse(pairs);
      } else {
        throw new Error("Unrecognized list format");
      }

      if (skipMissingMints) {
        const mintWhitelist = pairs.map((p) => p.mint);
        const availableMints = await getWalletMints({
          connection,
          publicKey: wallet.publicKey,
          mintWhitelist,
        });

        const skipped = pairs.filter((p) => !availableMints.includes(p.mint));
        if (skipped.length > 0) {
          console.warn("Skipping:");
          skipped.forEach((s) =>
            console.warn(`Mint: ${s.mint} => To: ${s.destination}`)
          );
          console.warn();
        }

        pairs = pairs.filter((p) => availableMints.includes(p.mint));
      }

      await sendMints({
        connection,
        wallet,
        pairs,
        bundleSize: parseInt(bundleSize),
        concurrency: parseInt(concurrency),
      });

      process.exit(0);
    }
  );

program.parse();
