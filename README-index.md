# Solana Program Index

The Solana Program Index is an index of verified checksums and IDLs of Anchor programs uploaded to the [Solana Program Registry](https://github.com/DeployDAO/solana-program-registry).

The goal of this index is to provide useful program information in O(1) lookup time, without requiring interacting with a Solana node. This index may also be replicated in different durable formats such as on-chain, via IPFS/Arweave, or on a local filesystem.

## Usage

The entire API is based on flat files stored on GitHub, so one may request information cross-origin directly from a browser via `fetch` or similar.

IDLs are keyed by program address and follow the following format:

```
https://raw.githubusercontent.com/DeployDAO/solana-program-index/master/idls/<ADDRESS>.json
```

Checksums are keyed by the lowercase hex SHA256 hash and follow the following format:

```
https://github.com/DeployDAO/solana-program-index/blob/master/artifacts/<CHECKSUM>.json
```

## License

Apache-2.0.
