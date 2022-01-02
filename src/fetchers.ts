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
