import * as fs from "fs/promises";
import { mapValues, startCase } from "lodash";
import { parse } from "yaml";

import type { Author, Build, VerifiedOrganization } from "./types";

export const loadPrograms = async (): Promise<
  Record<string, readonly string[]>
> => {
  const programsListRaw = await fs.readFile(`${__dirname}/../programs.yml`);
  return parse(programsListRaw.toString()) as Record<string, string[]>;
};

export type Organization = VerifiedOrganization;

export const loadOrganizations = async (): Promise<
  Record<string, Organization>
> => {
  const orgsListRaw = await fs.readFile(`${__dirname}/../organizations.yml`);
  const orgsList = parse(orgsListRaw.toString()) as Record<
    string,
    Omit<Organization, "github">
  >;
  return mapValues(orgsList, (org, github) => ({ ...org, github }));
};

export const describeBuild = (repo: string, tag: string): Build => {
  const slug = `${repo.replace("/", "__")}-${tag}`;
  const [org, repoName] = repo.split("/");
  if (!org || !repoName) {
    throw new Error(`invalid repo format: ${repo}`);
  }
  return {
    slug,
    org,
    repoName,
    source: `https://github.com/${repo}/tree/${tag}`,
    tag,
  };
};

export const makeProgramLabel = (author: Author, programName: string) =>
  `${author.info?.name ?? `@${author.name}`} - ${startCase(programName)}`;
