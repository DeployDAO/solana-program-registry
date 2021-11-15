{ pkgs }:
pkgs.mkShell {
  buildInputs = with pkgs; [ (import ./ci.nix { inherit pkgs; }) ];
}
