require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  extends: ["@saberhq"],
  parserOptions: {
    project: "tsconfig.json",
  },
};
