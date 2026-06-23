import { redirect } from "next/navigation";

export default function Home() {
  // Home page just redirects based on auth state
  redirect("/login");
}
