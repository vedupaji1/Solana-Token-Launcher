# Solana-Token-Launcher

Solana-Token-Launcher is a collection of scripts designed to assist in creating `spl-token`, listing them on `raydium-dex`, and performing operations related to tokens.

## Features

- Create a complete `spl-token` that meets all requirements for listing on a DEX.
- Launch `spl-token` on `raydium-dex`.
- Airdrop `spl-token` to a list of addresses.
- Swap `spl-token` on `raydium-dex` in bulk or batch.
- Perform sniping operations on `raydium-dex`.

## Setup

1. Go to the root directory of this project.
2. Run `npm i`.
3. Install TypeScript globally using `npm install -g typescript`.
4. Install ts-node globally using `npm install -g ts-node`.
5. Change to the `src` directory with `cd ./src`. Ensure you execute scripts from the `src` directory.

## Usage

To perform any operation using the scripts, you need to define your inputs in the `config` files. Check the `config` directory; you will find some `json` files with attributes that are self-explanatory. To fulfill your requirements, modify them and provide your input data.

Once you have modified the `config` file, you can execute the script using `ts-node <script name>`.

For example, to create a token:

1. Modify the `./config/tokenData.json` file by defining your token name, symbol, etc. Additionally, modify the `./config/credentials.json` file and add your private key and other details.
2. Ensure you have properly modified the mentioned `config` files.
3. Run `ts-node ./publishToken.ts`.

In this way, you can also use other scripts. Although I could provide more details, it is actually quite straightforward to use them.
