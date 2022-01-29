import type { Idl } from "@project-serum/anchor";
import type { AxiosError } from "axios";
import axios from "axios";
import * as fs from "fs/promises";
import { basename } from "path";
import invariant from "tiny-invariant";

import type { Build } from "../src/config";
import {
  describeBuild,
  loadOrganizations,
  loadPrograms,
  makeProgramLabel,
} from "../src/config";
import type { BuildInfo } from "../src/fetchers";
import {
  fetchBuildAddresses,
  fetchBuildChecksums,
  fetchBuildInfo,
  fetchSizes,
} from "../src/fetchers";

const buildURL = ({ slug, file }: { slug: string; file: string }) =>
  `https://raw.githubusercontent.com/DeployDAO/verified-program-artifacts/verify-${slug}/${file}`;

const buildDownloadURL = ({ slug, file }: { slug: string; file: string }) =>
  `https://github.com/DeployDAO/verified-program-artifacts/raw/verify-${slug}/${file}`;

const generateIndex = async () => {
  const programsList = await loadPrograms();
  const orgsList = await loadOrganizations();

  const indexDir = `${__dirname}/../index/`;
  await fs.mkdir(indexDir, { recursive: true });
  await fs.mkdir(`${indexDir}idls/`, { recursive: true });
  await fs.mkdir(`${indexDir}programs/`, { recursive: true });
  await fs.mkdir(`${indexDir}artifacts/`, { recursive: true });
  await fs.mkdir(`${indexDir}artifacts-by-id/`, { recursive: true });

  const lastTags = Object.entries(programsList).map(([repo, tags]) => {
    const lastTag = tags[tags.length - 1];
    invariant(lastTag, `no tags for ${repo}`);
    return [repo, lastTag] as const;
  });

  const programs: {
    label: string;
    name: string;
    repo: string;
    tag: string;
    address: string;
    shasum: string;
  }[] = [];

  for (const [repo, tag] of lastTags) {
    const build = describeBuild(repo, tag);
    const { slug, org } = build;
    try {
      const addresses = await fetchBuildAddresses(build);
      const checksums = await fetchBuildChecksums(build);

      for (const [programName, address] of Object.entries(addresses)) {
        let theIdl: Idl | null = null;
        try {
          const { data: idl } = await axios.get<Idl>(
            buildURL({ slug, file: `idl/${programName}.json` })
          );
          await fs.writeFile(
            `${indexDir}idls/${address}.json`,
            JSON.stringify(idl)
          );
          theIdl = idl;
        } catch (e) {
          if ((e as AxiosError).response?.status !== 404) {
            throw e;
          }
          console.warn(`Could not find idl for ${repo} ${tag}`);
        }

        const shasum = Object.entries(checksums).find(
          ([_, fileName]) =>
            fileName === `artifacts/verifiable/${programName}.so`
        )?.[0];
        if (!shasum) {
          throw new Error(`shasum not found for program: ${repo} ${tag}`);
        }

        const tagsOfRepo = programsList[repo];
        await fs.writeFile(
          `${indexDir}programs/${address}.json`,
          JSON.stringify({
            label: makeProgramLabel(orgsList, org, programName),
            latest: { ...build, shasum },
            releases: tagsOfRepo?.map((tag) => describeBuild(repo, tag)) ?? [],
            hasIDL: !!theIdl,
          })
        );

        programs.push({
          label: makeProgramLabel(orgsList, org, programName),
          name: programName,
          repo,
          tag,
          address,
          shasum,
        });
      }
    } catch (e) {
      if ((e as AxiosError).response?.status !== 404) {
        throw e;
      }
      console.warn(`Could not find idl for ${repo} ${tag}`);
    }
  }

  await fs.writeFile(`${indexDir}programs.json`, JSON.stringify(programs));

  const builds: {
    build: Build;
    addresses: Record<string, string>;
    checksums: Record<string, string>;
    info: BuildInfo | null;
    sizes: Record<string, string> | null;
  }[] = [];

  const allTags = Object.entries(programsList).flatMap(([repo, tags]) =>
    tags.map((tag) => [repo, tag] as const)
  );
  for (const [repo, tag] of allTags) {
    const tagsOfRepo = programsList[repo];
    const isLatest = !!(
      tagsOfRepo && tagsOfRepo[tagsOfRepo.length - 1] === tag
    );

    const build = describeBuild(repo, tag);
    const { slug, org, source } = build;

    try {
      const addresses = await fetchBuildAddresses(build);
      const checksums = await fetchBuildChecksums(build);
      const info = await fetchBuildInfo(build);
      const sizes = await fetchSizes(build);
      builds.push({
        build,
        addresses,
        checksums,
        info,
        sizes,
      });

      for (const [checksum, fileName] of Object.entries(checksums)) {
        console.log(`processing ${checksum}`);
        if (fileName.endsWith(".so")) {
          const programName = basename(fileName).slice(0, -".so".length);
          const programLabel = makeProgramLabel(orgsList, org, programName);
          const id = `${org}/${programName}`;
          const artifactMeta = {
            id,
            tag,
            name: `${programLabel} ${tag}`,
            source,
            url: buildDownloadURL({
              slug,
              file: `${fileName.slice("artifacts/".length)}`,
            }),
            checksum,
          };

          const artifactMetaStr = JSON.stringify(artifactMeta);
          await fs.writeFile(
            `${indexDir}artifacts/${checksum}.json`,
            artifactMetaStr
          );
          await fs.mkdir(`${indexDir}artifacts-by-id/${org}`, {
            recursive: true,
          });
          await fs.writeFile(
            `${indexDir}artifacts-by-id/${id}@${tag}.json`,
            artifactMetaStr
          );
          if (isLatest) {
            await fs.writeFile(
              `${indexDir}artifacts-by-id/${id}@latest.json`,
              artifactMetaStr
            );
          }
        }
      }
    } catch (e) {
      if ((e as AxiosError).response?.status !== 404) {
        throw e;
      }
      console.warn(`Could not find checksums for ${repo} ${tag}`);
    }
  }
  await fs.writeFile(`${indexDir}builds.json`, JSON.stringify(builds));
};

generateIndex().catch((err) => {
  console.error(err);
  process.exit(1);
});
