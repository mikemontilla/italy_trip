import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="container py-5">
      <h2 className="fw-bold mb-1" style={{ color: "var(--color-dark-navy)" }}>
        ¡Bienvenido, {session.user.name}! 🎉
      </h2>
      <p className="text-muted">Aquí van a aparecer tus eventos. ¡Ya casi!</p>
    </div>
  );
}
