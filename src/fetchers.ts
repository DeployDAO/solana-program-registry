import type { AxiosError } from "axios";
import axios from "axios";

import type { Build } from "./config";

const buildRawArtifactURL = ({ slug, file }: { slug: string; file: string }) =>
  `https://raw.githubusercontent.com/DeployDAO/verified-program-artifacts/verify-${slug}/${file}`;

export const fetchBuildAddresses = async (
  build: Build
): Promise<Record<string, string>> => {
  const { data: addresses } = await axios.get<Record<string, string>>(
    buildRawArtifactURL({ slug: build.slug, file: "addresses.json" })
  );
  return addresses;
};

export const fetchBuildChecksums = async (
  build: Build
): Promise<Record<string, string>> => {
  const { data: addresses } = await axios.get<Record<string, string>>(
    buildRawArtifactURL({ slug: build.slug, file: "checksums.json" })
  );
  return addresses;
};

export interface BuildInfo {
  anchorVersion: string;
  createdAt: string;
  repo: string;
  tag: string;
  slug: string;
}

export const fetchBuildInfo = async (
  build: Build
): Promise<BuildInfo | null> => {
  try {
    const { data } = await axios.get<BuildInfo>(
      buildRawArtifactURL({ slug: build.slug, file: "build-info.json" })
    );
    return data;
  } catch (e) {
    if ((e as AxiosError).response?.status !== 404) {
      throw e;
    }
    return null;
  }
};

export const fetchSizes = async (
  build: Build
): Promise<Record<string, string> | null> => {
  try {
    const { data } = await axios.get<Record<string, string>>(
      buildRawArtifactURL({ slug: build.slug, file: "sizes.json" })
    );
    return data;
  } catch (e) {
    if ((e as AxiosError).response?.status !== 404) {
      throw e;
    }
    return null;
  }
};
