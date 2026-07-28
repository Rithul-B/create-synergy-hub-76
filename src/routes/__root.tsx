import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { useEffect, type ReactNode } from "react";

import { Toaster } from "sonner";

import appCss from "../styles.css?url";

import { reportLovableError } from "../lib/lovable-error-reporting";

import { applyTheme, readTheme } from "../lib/theme";

import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "../lib/brand";

import { supabase } from "@/integrations/supabase/client";
import { useSessionKeepAlive } from "@/lib/session";

const DEFAULT_TITLE = `${APP_NAME} — ${APP_TAGLINE}`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>

        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>

        <a
          href="/"
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);

  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>

        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },

      { name: "viewport", content: "width=device-width, initial-scale=1" },

      { title: DEFAULT_TITLE },

      { name: "description", content: APP_DESCRIPTION },

      { name: "author", content: APP_NAME },

      { property: "og:type", content: "website" },

      { name: "twitter:card", content: "summary_large_image" },

      { property: "og:title", content: DEFAULT_TITLE },

      { name: "twitter:title", content: DEFAULT_TITLE },

      { property: "og:description", content: APP_DESCRIPTION },

      { name: "twitter:description", content: APP_DESCRIPTION },

      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/45c0b90f-a2ff-4a6c-830c-b5b360b74137",
      },

      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/45c0b90f-a2ff-4a6c-830c-b5b360b74137",
      },
    ],

    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),

  shellComponent: RootShell,

  component: RootComponent,

  notFoundComponent: NotFoundComponent,

  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>

      <body>
        {children}

        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useSessionKeepAlive();

  const { queryClient } = Route.useRouteContext();

  const router = useRouter();

  useEffect(() => {
    applyTheme(readTheme());

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const onChange = () => applyTheme(readTheme());

    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;

        router.invalidate();

        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });

      return () => sub.subscription.unsubscribe();
    } catch (error) {
      console.error("Study Forge auth listener could not start", error);
    }
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />

      <Toaster richColors />
    </QueryClientProvider>
  );
}
