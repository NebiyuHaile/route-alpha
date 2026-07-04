import type { Metadata } from "next";
import AuthPage from "../../components/AuthPage";

export const metadata: Metadata = {
  title: "Sign In or Create Account",
  description:
    "Sign in to RouteAlpha to access the routing dashboard and inference playground.",
  robots: {
    index: false,
  },
};

export default function AuthRoute() {
  return <AuthPage />;
}
