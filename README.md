# Solana Program Registry

A verified registry of open source Solana programs. 🚀

## Usage

Add your project to `programs.yml`. Please message `ianm` on Keybase if you have any questions.

### How it works

The Solana Program Registry is a set of scripts that automatically builds verifiable sources of Solana programs using GitHub Actions.

It works as follows:

1. A dev adds their GitHub repo and tag to `programs.yml`
2. GitHub Actions sees this change and creates a [Workflow](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions#understanding-the-workflow-file) for building the program.
3. The workflow gets added to the [Verified Programs Builder](https://github.com/DeployDAO/verified-programs-builder) repo.
4. The Verified Programs Builder sees the new Workflow and executes it, building the binaries and generating checksums.
5. The Verified Programs Builder uploads the result to the [Verified Program Artifacts](https://github.com/DeployDAO/verified-program-artifacts) repo.

## Roadmap

The goal of the Solana Program Registry is to create a way for people to easily verify the programs they interact with on-chain. Some tools we'd like to see built include:

- A tool to download the program binary from the blockchain and verify the hash locally, either via CLI or via the browser
- A tool to verify the contents of BPF Upgradeable Loader program data buffers
- An integration with a Solana block explorer
- Wallet integrations, to warn users if they are interacting with unverified source code
- Transformation into a DAO, to eliminate the central point of failure of GitHub
- A website for browsing the programs and artifacts that have been published

## License

Apache 2.0.
