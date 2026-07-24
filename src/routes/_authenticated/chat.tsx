import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/chat")({ component: () => <Outlet /> });
