# NFTs Airdrop tool

Send multiple NFTs from a wallet to one or many wallets, bundling up to 6 mints per transaction and concurrently.

## Requirements

- Node 16+

Have all the NFTs in a wallet, use the keypair to sign and pay for fees. The tool will do the required checks, close wallet token accounts, and bundle up to 6 mints per transaction for efficiency.

## Setup

`npm install`

# Send NFTs to a specific wallet

Whitelist file must be an array of base58 mints, specify `ANY` to send a random NFT from wallet to send.

```
Usage: nfts-airdrop send-to-one-wallet [options]

Options:
  -e, --env <string>          environment
  -k, --keypair <path>        keypair for wallet holding the nfts to send
  -r, --rpc <string>          rpc to use
  -d, --destination <string>  wallet that will receive the nfts
  -n, --number <int>          amount of nfts to send to destination
  -w, --whitelist <string>    path to a json list of whitelisted mints of nfts to be send or `ANY` to pick send a random nft from the wallet
  -b, --bundle-size <int>     mints bundled per transaction, max is 6 (default: 6)
  -c, --concurrency <int>     number of parallel transactions (default: 5)
```

# Send NFTs to many wallets

List file must be either a csv or tsv file of `mint` and `destination` pairs. If any transaction fails to complete, you can retry the process and pass the `-s` or `--skip-missing-mints` to skip those sent from the original list and retry the failed ones.

```
Usage: nfts-airdrop send-to-many-wallets [options]

Options:
  -e, --env <string>        environment
  -k, --keypair <path>      keypair for wallet holding the nfts to send
  -r, --rpc <string>        rpc to use
  -l, --list <path>         csv or tsv file containing <mint,destination> to send specific nft to specific destination
  -b, --bundle-size <int>   mints bundled per transaction, max is 6 (default: 6)
  -c, --concurrency <int>   number of parallel transactions (default: 5)
  -s, --skip-missing-mints  skip missing mints in keypair wallet (useful for retries)
```
