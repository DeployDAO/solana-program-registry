{
  description = "StableSwap development environment.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    saber-overlay.url = "github:saber-hq/saber-overlay";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, saber-overlay, flake-utils }:
    flake-utils.lib.eachSystem [
      "aarch64-darwin"
      "x86_64-linux"
      "x86_64-darwin"
    ]
      (system:
        let
          pkgs = import nixpkgs { inherit system; }
            // saber-overlay.packages.${system};
          devShell = pkgs.buildEnv {
            name = "dev-shell";
            paths = with pkgs; [ yj jq bash findutils coreutils ];
          };
        in
        {
          packages = with pkgs; {
            inherit devShell;
            anchor-0_12_0 = pkgs.anchor-0_12_0;
            anchor-0_13_2 = pkgs.anchor-0_13_2;
            anchor-0_15_0 = pkgs.anchor-0_15_0;
            anchor-0_16_1 = pkgs.anchor-0_16_1;
            anchor-0_17_0 = pkgs.anchor-0_17_0;
            anchor-0_18_2 = pkgs.anchor-0_18_2;
            anchor-0_19_0 = pkgs.anchor-0_19_0;
            anchor-0_20_1 = pkgs.anchor-0_20_1;
            anchor-0_21_0 = pkgs.anchor-0_21_0;
            anchor-0_22_0 = pkgs.anchor-0_22_0;
            anchor-0_23_0 = pkgs.anchor-0_23_0;
          };

          devShell = pkgs.mkShell { buildInputs = [ devShell ]; };
        });
}
