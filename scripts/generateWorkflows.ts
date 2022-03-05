import type { AxiosError } from "axios";
import axios from "axios";
import * as fs from "fs/promises";
import * as toml from "toml";
import * as yaml from "yaml";

import { loadPrograms } from "../src/config";
import type { AnchorManifest } from "../src/types";

const ANCHOR_PACKAGE_FOR_VERSION: Record<string, string> = {
  "0.12": "0_12_0",
  "0.13": "0_13_2",
  "0.14": "0_13_2",
  "0.15": "0_15_0",
  "0.16": "0_16_1",
  "0.17": "0_17_0",
  "0.18": "0_18_2",
  "0.19": "0_19_0",
  "0.20": "0_20_1",
  "0.21": "0_21_0",
  "0.22": "0_22_0",
};

const makeWorkflowYaml = ({
  template,
  repo,
  tag,
  slug,
  manifest,
}: {
  template: object;
  repo: string;
  tag: string;
  slug: string;
  manifest: AnchorManifest;
}) => {
  const { anchor_version } = manifest;
  const anchorPackage = anchor_version
    ? ANCHOR_PACKAGE_FOR_VERSION[
        anchor_version.split(".").slice(0, 2).join(".")
      ] ?? "0_22_0"
    : "0_22_0";

  const header = {
    name: `Verify ${repo} ${tag}`,
    on: {
      push: {
        paths: [`.github/workflows/verify-${slug}.yml`],
      },
    },
    defaults: {
      env: {
        ANCHOR_CLI_VERSION: anchorPackage,
        PROGRAM_GITHUB_REPO: repo,
        PROGRAM_GIT_TAG: tag,
        PROGRAM_SLUG: slug,
        PROGRAM_TARBALL_URL: `https://github.com/${repo}/archive/refs/tags/${tag}.tar.gz`,
      },
    },
  };
  return yaml.stringify({
    ...header,
    ...template,
  });
};

const generateWorkflows = async () => {
  const programsList = await loadPrograms();

  const allTags = Object.entries(programsList).flatMap(([repo, tags]) =>
    tags.map((tag) => [repo, tag] as const)
  );

  const template: object = yaml.parse(
    (await fs.readFile(`${__dirname}/verify-workflow-jobs.yml`)).toString(
      "utf-8"
    )
  ) as object;

  const outDir = `${__dirname}/../out/`;
  await fs.mkdir(outDir, { recursive: true });
  const workflowsDir = `${outDir}/.github/workflows/`;
  await fs.mkdir(workflowsDir, { recursive: true });

  await fs.mkdir(`${outDir}/manifests`, { recursive: true });

  for (const [repo, tag] of allTags) {
    const slug = `${repo.replace("/", "__")}-${tag}`;

    const manifestJSONPath = `${outDir}/manifests/${slug}.json`;
    let manifest: AnchorManifest;

    // don't fetch the manifest multiple times
    if ((await fs.stat(manifestJSONPath)).isFile()) {
      manifest = JSON.parse(
        (await fs.readFile(manifestJSONPath)).toString()
      ) as AnchorManifest;
    } else {
      const anchorTomlURL = `https://cdn.jsdelivr.net/gh/${repo}@${tag}/Anchor.toml`;

      let anchorToml: string;
      try {
        anchorToml = (await axios.get<string>(anchorTomlURL)).data;
      } catch (e) {
        if ((e as AxiosError).response?.status === 404) {
          throw new Error(
            `Could not find the Anchor.toml for ${repo}@${tag}. Ensure that the repository is public and that Anchor.toml is in the repository root.`
          );
        }
        throw e;
      }

      manifest = toml.parse(anchorToml) as AnchorManifest;

      await fs.writeFile(
        `${outDir}/manifests/${slug}.json`,
        JSON.stringify(manifest, null, 2)
      );
      await fs.writeFile(`${outDir}/manifests/${slug}.toml`, anchorToml);
    }

    await fs.writeFile(
      `${workflowsDir}/verify-${slug}.yml`,
      makeWorkflowYaml({ manifest, repo, tag, slug, template })
    );
  }
};

generateWorkflows().catch((err) => {
  console.error(err);
  process.exit(1);
});
