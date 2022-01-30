/**
 * Identifier of a verified program build.
 */
export interface Build {
  slug: string;
  org: string;
  repoName: string;
  source: string;
  tag: string;
}

/**
 * Miscellaneous information about a build.
 */
export interface BuildInfo {
  anchorVersion: string;
  createdAt: string;
  repo: string;
  tag: string;
  slug: string;
}

/**
 * Information about an individual build artifact.
 */
export interface ArtifactInfo {
  /**
   * Relative path of the artifact.
   */
  path: string;
  /**
   * Size of the artifact, in bytes.
   */
  size: number | null;
  /**
   * Artifact checksum.
   */
  checksum: string;
  /**
   * URL for downloading the artifact.
   */
  downloadURL: string;
}

/**
 * A verified organization in `organizations.yml`.
 */
export interface VerifiedOrganization {
  name: string;
  github: string;
  website?: string;
}

export interface Author {
  /**
   * GitHub username/organization name.
   */
  name: string;
  /**
   * Verified info from `organizations.yml`.
   */
  info: VerifiedOrganization | null;
}

/**
 * Full description of a verified program build.
 */
export interface BuildDetails {
  /**
   * The Build.
   */
  build: Build;
  /**
   * Addresses of programs covered by the build.
   */
  addresses: Record<string, string>;
  /**
   * Build information.
   */
  info: BuildInfo | null;
  /**
   * List of all artifacts generated during this build and their file sizes.
   */
  artifacts: ArtifactInfo[];
  /**
   * Link to the workspace where the build took place.
   */
  workspaceURL: string;
  /**
   * Author of the build.
   */
  author: Author;
}

/**
 * Information about a program published to the registry.
 */
export interface ProgramInfo {
  /**
   * Unique identifier of the program.
   *
   * This should be `$slug-$programName`.
   */
  id: string;
  /**
   * Name of the program, unscoped.
   */
  name: string;
  /**
   * Verified information about the organization, if applicable.
   */
  author: Author;
  /**
   * Rendered label for the program.
   */
  label: string;
  /**
   * Program address.
   */
  address: string;
  /**
   * GitHub information.
   */
  github: {
    organization: string;
    repo: string;
  };
}

/**
 * A verifiable program build.
 */
export interface VerifiableProgramRelease {
  /**
   * Globally unique identifier for the release.
   *
   * This is in the form of `@$org/$programName@$tag`.
   */
  id: string;
  /**
   * The program.
   */
  program: ProgramInfo;
  /**
   * The build artifact.
   */
  artifact: ArtifactInfo;
  /**
   * The trimmed build artifact. Its checksum is used to generate
   */
  trimmedArtifact: ArtifactInfo;
  /**
   * The IDL artifact.
   */
  idl: ArtifactInfo | null;
  /**
   * Full description of the build.
   */
  build: BuildDetails;
}

/**
 * All information about a program.
 */
export interface ProgramDetails {
  /**
   * Program info.
   */
  program: ProgramInfo;
  /**
   * All known releases.
   */
  releases: VerifiableProgramRelease[];
}
