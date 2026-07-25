import type { Plugin } from "vite";

const DEFAULT_ORIGIN = "https://create-synergy-hub-76.lovable.app";

/** Forwards Lovable Cloud OAuth starts to the deployed app when running locally. */
export function oauthLocalProxyPlugin(): Plugin {
  const target = (process.env.VITE_LOVABLE_APP_ORIGIN ?? DEFAULT_ORIGIN).replace(/\/$/, "");
  return {
    name: "learnlab-oauth-local-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?", 1)[0];
        if (path !== "/~oauth/initiate") return next();
        const qs = (req.url ?? "").includes("?") ? (req.url ?? "").slice((req.url ?? "").indexOf("?")) : "";
        res.writeHead(302, { Location: `${target}/~oauth/initiate${qs}` });
        res.end();
      });
    },
  };
}
