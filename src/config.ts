import * as fs from "fs/promises";
import { mapValues } from "lodash";
import { parse } from "yaml";

export const loadPrograms = async (): Promise<
  Record<string, readonly string[]>
> => {
  const programsListRaw = await fs.readFile(`${__dirname}/../programs.yml`);
  return parse(programsListRaw.toString()) as Record<string, string[]>;
};

export interface Organization {
  name: string;
  website: string;
  github: string;
}

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
