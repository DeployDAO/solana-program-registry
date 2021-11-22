{ pkgs }: pkgs.mkShell { buildInputs = with pkgs; [ yj jq ]; }
