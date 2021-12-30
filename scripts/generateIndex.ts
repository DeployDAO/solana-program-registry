import type { Idl } from "@project-serum/anchor";
import type { AxiosError } from "axios";
import axios from "axios";
import * as fs from "fs/promises";
import { startCase } from "lodash";
import { basename } from "path";
import invariant from "tiny-invariant";

import { loadOrganizations, loadPrograms } from "../src/config";

const buildURL = ({ slug, file }: { slug: string; file: string }) =>
  `https://raw.githubusercontent.com/DeployDAO/verified-program-artifacts/verify-${slug}/${file}`;

const generateIndex = async () => {
  const programsList = await loadPrograms();
  const orgsList = await loadOrganizations();

  const indexDir = `${__dirname}/../index/`;
  await fs.mkdir(indexDir, { recursive: true });
  await fs.mkdir(`${indexDir}idls/`, { recursive: true });
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
    const slug = `${repo.replace("/", "__")}-${tag}`;
    try {
      const { data: addresses } = await axios.get<Record<string, string>>(
        buildURL({ slug, file: "addresses.json" })
      );
      const { data: checksums } = await axios.get<Record<string, string>>(
        buildURL({ slug, file: "checksums.json" })
      );
      for (const [programName, address] of Object.entries(addresses)) {
        try {
          const { data: idl } = await axios.get<Idl>(
            buildURL({ slug, file: `idl/${programName}.json` })
          );
          await fs.writeFile(
            `${indexDir}idls/${address}.json`,
            JSON.stringify(idl)
          );
        } catch (e) {
          if ((e as AxiosError).response?.status !== 404) {
            throw e;
          }
          console.warn(`Could not find idl for ${repo} ${tag}`);
        }

        const [org, repoName] = repo.split("/");
        if (!org || !repoName) {
          throw new Error(`invalid repo format: ${repo}`);
        }
        const shasum = Object.entries(checksums).find(
          ([_, fileName]) =>
            fileName === `artifacts/verifiable/${programName}.so`
        )?.[0];
        if (!shasum) {
          throw new Error(`shasum not found for program: ${repo} ${tag}`);
        }

        programs.push({
          label: `${orgsList[org]?.name ?? `@${org}`} - ${startCase(
            programName
          )}`,
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

  const allTags = Object.entries(programsList).flatMap(([repo, tags]) =>
    tags.map((tag) => [repo, tag] as const)
  );
  for (const [repo, tag] of allTags) {
    const tagsOfRepo = programsList[repo];
    const isLatest = !!(
      tagsOfRepo && tagsOfRepo[tagsOfRepo.length - 1] === tag
    );

    const slug = `${repo.replace("/", "__")}-${tag}`;

    const [org, repoName] = repo.split("/");
    if (!org || !repoName) {
      throw new Error(`invalid repo format: ${repo}`);
    }
    const orgName = orgsList[org]?.name ?? `@${org}`;

    try {
      const { data: checksums } = await axios.get<Record<string, string>>(
        buildURL({ slug, file: "checksums.json" })
      );
      for (const [checksum, fileName] of Object.entries(checksums)) {
        console.log(`processing ${checksum}`);
        if (fileName.endsWith(".so")) {
          const programNameRaw = basename(fileName).slice(0, -".so".length);
          const programName = startCase(programNameRaw);
          const id = `${org}/${programNameRaw}`;
          const artifactMeta = {
            id,
            tag,
            name: `${orgName} - ${programName} ${tag}`,
            source: `https://github.com/${repo}/tree/${tag}`,
            url: buildURL({ slug, file: fileName }),
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
};

generateIndex().catch((err) => {
  console.error(err);
  process.exit(1);
});
