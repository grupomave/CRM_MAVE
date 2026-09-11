import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "supabase/.branches/**"],
  },
];

export default eslintConfig;
