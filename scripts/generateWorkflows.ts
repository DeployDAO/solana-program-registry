import * as fs from "fs/promises";

import { loadPrograms } from "../src/config";

const makeWorkflowYaml = ({
  repo,
  tag,
  slug,
  anchorVersion = "0_19_0",
}: {
  repo: string;
  tag: string;
  slug: string;
  anchorVersion?: string;
}) => {
  return `
name: Verify ${repo} ${tag}

on:
  push:
    paths:
      - ".github/workflows/verify-${slug}.yml"

jobs:
  release-binaries:
    runs-on: ubuntu-latest
    name: Release verifiable binaries
    steps:
      - uses: actions/checkout@v2
      - uses: cachix/install-nix-action@v16
      - name: Setup Cachix
        uses: cachix/cachix-action@v10
        with:
          name: saber
          authToken: \${{ secrets.CACHIX_AUTH_TOKEN }}
      - name: Download sources from GitHub
        run: curl -L https://github.com/${repo}/archive/refs/tags/${tag}.tar.gz > release.tar.gz
      - name: Extract sources
        run: echo $(tar xzvf release.tar.gz | head -1 | cut -f1 -d"/") > dirname
      - name: Login to Anchor
        run: nix shell ./#anchor-${anchorVersion} --command anchor login \${{ secrets.ANCHOR_AUTH_TOKEN }}
      - name: Extract addresses
        run: |
          cd $(cat dirname)
          ls
          nix shell ../#devShell --command bash -c 'cat Anchor.toml | yj -t | jq .programs.mainnet > addresses.json'
          echo "Addresses"
          cat addresses.json
      - name: Perform verifiable build
        run: |
          cd $(cat dirname)
          cat addresses.json | jq .
          nix shell ../#devShell --command bash -c 'cat addresses.json | jq -r ". | keys | .[]" > programs.txt'
          for PROGRAM in $(cat programs.txt); do
            nix shell ../#anchor-${anchorVersion} --command anchor build --verifiable --program-name "$PROGRAM"
          done
      - name: Publish build to Anchor Registry
        run: |
          cd $(cat dirname)
          for PROGRAM in $(cat programs.txt); do
            yes 'yes' | nix shell ../#anchor-${anchorVersion} --command anchor publish "$PROGRAM" --provider.cluster mainnet
          done
      - name: Record program artifacts
        run: |
          mkdir artifacts
          mv $(cat dirname)/target/verifiable/ artifacts/verifiable/
          mv $(cat dirname)/target/idl/ artifacts/idl/
          mv $(cat dirname)/addresses.json artifacts/addresses.json

          sha256sum release.tar.gz >> artifacts/checksums.txt
          sha256sum artifacts/verifiable/* >> artifacts/checksums.txt

          # IDLs might not be generated
          if compgen -G "artifacts/idl/*" > /dev/null; then
            sha256sum artifacts/idl/* >> artifacts/checksums.txt
          fi

          cat artifacts/checksums.txt | jq -R '. | split("  ") | [{key:.[0],value:.[1]}] | from_entries' | jq -s add > artifacts/checksums.json

          echo "anchorVersion: \\"$(nix shell .#anchor-${anchorVersion} --command anchor --version)\\"" >> artifacts/build-info.yml
          echo "createdAt: \\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\\"" >> artifacts/build-info.yml
          echo 'repo: "${repo}"' >> artifacts/build-info.yml
          echo 'tag: "${tag}"' >> artifacts/build-info.yml
          echo 'slug: "${slug}"' >> artifacts/build-info.yml
          nix shell .#devShell --command bash -c 'cat build-info.yml | yq > build-info.json'

          echo '---' >> artifacts/README.md
          cat artifacts/build-info.yml >> artifacts/README.md
          echo '---' >> artifacts/README.md
          echo '# ${repo} ${tag}' >> artifacts/README.md
          echo '## Checksums' >> artifacts/README.md
          echo '\`\`\`' >> artifacts/README.md
          cat artifacts/checksums.txt >> artifacts/README.md
          echo '\`\`\`' >> artifacts/README.md
      - name: Upload
        uses: peaceiris/actions-gh-pages@v3
        with:
          deploy_key: \${{ secrets.DIST_DEPLOY_KEY }}
          external_repository: DeployDAO/verified-program-artifacts
          publish_branch: verify-${slug}
          publish_dir: ./artifacts/
`;
};

const generateWorkflows = async () => {
  const programsList = await loadPrograms();

  const allTags = Object.entries(programsList).flatMap(([repo, tags]) =>
    tags.map((tag) => [repo, tag] as const)
  );

  const outDir = `${__dirname}/../out/`;
  await fs.mkdir(outDir, { recursive: true });
  const workflowsDir = `${outDir}/.github/workflows/`;
  await fs.mkdir(workflowsDir, { recursive: true });
  for (const [repo, tag] of allTags) {
    const slug = `${repo.replace("/", "__")}-${tag}`;
    await fs.writeFile(
      `${workflowsDir}/verify-${slug}.yml`,
      makeWorkflowYaml({ repo, tag, slug })
    );
  }
};

generateWorkflows().catch((err) => console.error(err));
