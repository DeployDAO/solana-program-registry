import type { Idl } from "@project-serum/anchor";
import type { AxiosError } from "axios";
import axios from "axios";
import * as fs from "fs/promises";
import { groupBy, mapValues, uniq } from "lodash";
import { basename } from "path";
import semver from "semver";
import invariant from "tiny-invariant";

import {
  describeBuild,
  loadOrganizations,
  loadPrograms,
  makeProgramLabel,
} from "../src/config";
import {
  fetchBuildAddresses,
  fetchBuildChecksums,
  fetchBuildInfo,
  fetchSizes,
} from "../src/fetchers";
import type {
  ArtifactInfo,
  Author,
  BuildDetails,
  ProgramDetails,
  ProgramInfo,
  VerifiableProgramRelease,
} from "../src/types";

const buildURL = ({ slug, file }: { slug: string; file: string }) =>
  `https://raw.githubusercontent.com/DeployDAO/verified-program-artifacts/verify-${slug}/${file}`;

const buildDownloadURL = ({ slug, file }: { slug: string; file: string }) =>
  `https://github.com/DeployDAO/verified-program-artifacts/raw/verify-${slug}/${file}`;

const buildBinaryDownloadURL = ({
  slug,
  file,
}: {
  slug: string;
  file: string;
}) =>
  `https://github.com/DeployDAO/verified-program-artifacts/blob/verify-${slug}/${file}?raw=true`;

/**
 * Generates a {@link VerifiableProgramRelease}.
 * @returns
 */
const generateRelease = ({
  artifacts,
  artifact,
  build,
}: {
  artifacts: ArtifactInfo[];
  artifact: ArtifactInfo;
  build: BuildDetails;
}): VerifiableProgramRelease => {
  const programName = basename(artifact.path).slice(0, -".so".length);
  const programLabel = makeProgramLabel(build.author, programName);
  const scopedProgramName = `@${build.author.name}/${programName}`;
  const releaseID = `${scopedProgramName}@${build.build.tag}`;
  const address = build.addresses[programName];
  if (!address) {
    throw new Error(`address for ${programName} not found`);
  }

  const trimmedArtifact = artifacts.find(
    (artifact) =>
      artifact.path === `artifacts/verifiable-trimmed/${programName}.so`
  );
  if (!trimmedArtifact) {
    throw new Error(`missing trimmed artifact`);
  }

  const idlArtifact = artifacts.find(
    (artifact) => artifact.path === `artifacts/idl/${programName}.so`
  );

  const programInfo: ProgramInfo = {
    id: `@${build.build.org}/${build.build.repoName}/${programName}`,
    name: programName,
    label: programLabel,
    address,
    author: build.author,
    github: {
      organization: build.build.org,
      repo: build.build.repoName,
    },
  };

  const release: VerifiableProgramRelease = {
    id: releaseID,
    program: programInfo,
    artifact,
    trimmedArtifact,
    idl: idlArtifact ?? null,
    build: build,
  };

  return release;
};

const writeReleaseArtifacts = async ({
  release,
  isLatest,
  indexDir,
}: {
  indexDir: string;
  release: VerifiableProgramRelease;
  isLatest: boolean;
}) => {
  const releaseJSON = JSON.stringify(release);
  await fs.writeFile(
    `${indexDir}releases/by-trimmed-checksum/${release.trimmedArtifact.checksum}.json`,
    releaseJSON
  );
  await fs.writeFile(
    `${indexDir}releases/by-checksum/${release.artifact.checksum}.json`,
    releaseJSON
  );
  const scopedName = `@${release.program.author.name}/${release.program.name}`;

  // scope
  await fs.mkdir(
    `${indexDir}releases/by-name/@${release.program.author.name}`,
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    `${indexDir}releases/by-name/${release.id}.json`,
    releaseJSON
  );
  if (isLatest) {
    await fs.writeFile(
      `${indexDir}releases/by-name/${scopedName}@latest.json`,
      releaseJSON
    );
  }
  await fetchAndWriteIDL({ indexDir, release, isLatest });
};

const fetchAndWriteIDL = async ({
  indexDir,
  release,
  isLatest,
}: {
  indexDir: string;
  release: VerifiableProgramRelease;
  isLatest: boolean;
}) => {
  try {
    const { data: idl } = await axios.get<Idl>(
      buildURL({
        slug: release.build.build.slug,
        file: `idl/${release.program.name}.json`,
      })
    );
    await fs.writeFile(
      `${indexDir}releases/by-name/${release.id}.idl.json`,
      JSON.stringify(idl)
    );
    if (isLatest) {
      await fs.writeFile(
        `${indexDir}idls/${release.program.address}.json`,
        JSON.stringify(idl)
      );
    }
  } catch (e) {
    if ((e as AxiosError).response?.status !== 404) {
      throw e;
    }
    console.warn(
      `Could not find idl for ${release.build.build.repoName} ${release.build.build.tag}`
    );
  }
};

const generateIndex = async () => {
  const programsList = await loadPrograms();
  const orgsList = await loadOrganizations();

  const indexDir = `${__dirname}/../index/`;
  await fs.mkdir(indexDir, { recursive: true });

  // IDLs and program info
  await fs.mkdir(`${indexDir}idls/`, { recursive: true });
  await fs.mkdir(`${indexDir}programs/`, { recursive: true });

  // releases
  await fs.mkdir(`${indexDir}releases/by-checksum/`, {
    recursive: true,
  });
  await fs.mkdir(`${indexDir}releases/by-trimmed-checksum/`, {
    recursive: true,
  });
  await fs.mkdir(`${indexDir}releases/by-name/`, {
    recursive: true,
  });

  const builds: BuildDetails[] = [];
  const programs: Record<string, ProgramInfo> = {};
  const artifactsByChecksum: Record<string, ArtifactInfo> = {};
  const allReleases: VerifiableProgramRelease[] = [];

  const allTags = Object.entries(programsList).flatMap(([repo, tags]) =>
    tags.map((tag) => [repo, tag] as const)
  );
  for (const [repo, tag] of allTags) {
    const tagsOfRepo = programsList[repo];

    // sort tags in descending order
    const sortedTags =
      tagsOfRepo?.slice().sort((a, b) => {
        if (semver.gt(a, b)) {
          return -1;
        }
        return 1;
      }) ?? [];

    const isLatest = !!(sortedTags[0] === tag);

    const build = describeBuild(repo, tag);
    const { slug, org } = build;

    try {
      const addresses = await fetchBuildAddresses(build);
      const checksums = await fetchBuildChecksums(build);
      const info = await fetchBuildInfo(build);
      const sizes = mapValues(await fetchSizes(build), (size) =>
        parseInt(size)
      );

      const artifacts = Object.entries(checksums).map(
        ([checksum, artifactPath]): ArtifactInfo => {
          const sizeStr = sizes?.[artifactPath] ?? null;
          const trimmedPath = artifactPath.slice("artifacts/".length);
          return {
            path: artifactPath,
            checksum,
            size: sizeStr,
            downloadURL: artifactPath.endsWith(".so")
              ? buildBinaryDownloadURL({
                  slug,
                  file: trimmedPath,
                })
              : buildDownloadURL({ slug, file: trimmedPath }),
          };
        }
      );

      const verifiedOrganizationInfo = orgsList[org] ?? null;
      const author: Author = {
        name: org,
        info: verifiedOrganizationInfo,
      };

      const details: BuildDetails = {
        build,
        addresses,
        info,
        artifacts,
        workspaceURL: `https://github.com/DeployDAO/verified-program-artifacts/tree/verify-${build.slug}`,
        author,
      };
      builds.push(details);

      const programReleases: VerifiableProgramRelease[] = artifacts
        .filter(
          (artifact) =>
            artifact.path.includes("artifacts/verifiable/") &&
            artifact.path.endsWith(".so")
        )
        .map((artifact) => {
          const release = generateRelease({
            artifacts,
            artifact,
            build: details,
          });
          if (!(release.program.id in programs)) {
            programs[release.program.id] = release.program;
          }
          return release;
        });

      artifacts.forEach((artifact) => {
        if (!(artifact.checksum in artifacts)) {
          artifactsByChecksum[artifact.checksum] = artifact;
        }
      });

      await Promise.all(
        programReleases.map(async (release) => {
          await writeReleaseArtifacts({ release, isLatest, indexDir });
        })
      );

      allReleases.push(...programReleases);
    } catch (e) {
      if ((e as AxiosError).response?.status !== 404) {
        throw e;
      }
      console.warn(`Could not find checksums for ${repo} ${tag}`);
    }
  }

  const programDetails = mapValues(
    groupBy(allReleases, (release) => release.program.id),
    (releases, programID): ProgramDetails => {
      const program = programs[programID];
      invariant(program);
      return {
        program,
        releases,
      };
    }
  );

  await Promise.all(
    Object.values(programDetails).map(async (programDetail) => {
      await fs.writeFile(
        `${indexDir}programs/${programDetail.program.address}.json`,
        JSON.stringify(programDetail)
      );
    })
  );

  const orgsCount = uniq(builds.map((b) => b.build.org)).length;
  const reposCount = uniq(
    builds.map((b) => `${b.build.org}/${b.build.repoName}`)
  ).length;

  await fs.writeFile(
    `${indexDir}meta.json`,
    JSON.stringify({
      lastUpdated: new Date().toISOString(),
      counts: {
        artifacts: Object.values(artifactsByChecksum).length,
        orgs: orgsCount,
        repos: reposCount,
        programs: Object.values(programs).length,
      },
    })
  );
  await fs.writeFile(
    `${indexDir}artifacts.json`,
    JSON.stringify(Object.values(artifactsByChecksum))
  );
  await fs.writeFile(`${indexDir}builds.json`, JSON.stringify(builds));
  await fs.writeFile(
    `${indexDir}programs.json`,
    JSON.stringify(Object.values(programs))
  );
};

generateIndex().catch((err) => {
  console.error(err);
  process.exit(1);
});
