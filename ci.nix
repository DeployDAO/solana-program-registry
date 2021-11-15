{ pkgs }:
pkgs.buildEnv {
  name = "ci";
  paths = with pkgs; [ anchor-0_18_0 ];
}
