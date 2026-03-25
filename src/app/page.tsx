import { redirect } from "next/navigation";

// le middleware gère déjà la protection des routes
// si on arrive ici c'est qu'on est connecté → dashboard
export default function Home() {
  redirect("/dashboard");
}