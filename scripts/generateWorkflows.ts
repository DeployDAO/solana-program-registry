import * as fs from "fs/promises";
import * as yaml from "yaml";

import { loadPrograms } from "../src/config";

const makeWorkflowYaml = ({
  template,
  repo,
  tag,
  slug,
  anchorVersion = "0_22_0",
}: {
  template: object;
  repo: string;
  tag: string;
  slug: string;
  anchorVersion?: string;
}) => {
  const header = {
    name: `Verify ${repo} ${tag}`,
    on: {
      push: {
        paths: [`.github/workflows/verify-${slug}.yml`],
      },
    },
    defaults: {
      env: {
        ANCHOR_CLI_VERSION: anchorVersion,
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
  for (const [repo, tag] of allTags) {
    const slug = `${repo.replace("/", "__")}-${tag}`;
    await fs.writeFile(
      `${workflowsDir}/verify-${slug}.yml`,
      makeWorkflowYaml({ repo, tag, slug, template })
    );
  }
};

generateWorkflows().catch((err) => console.error(err));
