import { auth, signOut } from "@/auth";
import Image from "next/image";

export default async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header
      className="d-flex align-items-center justify-content-between px-4 py-2 shadow-sm"
      style={{ backgroundColor: "var(--color-dark-navy)", minHeight: 56 }}
    >
      <span className="fw-bold fs-5" style={{ color: "var(--color-terracotta)" }}>
        SplitMate ✈️
      </span>

      {user && (
        <div className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? "avatar"}
                width={32}
                height={32}
                className="rounded-circle"
              />
            )}
            <span className="fw-semibold" style={{ color: "#fff", fontSize: "0.9rem" }}>
              {user.name}
            </span>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="btn btn-sm"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-warm-gray)",
                border: "1px solid var(--color-warm-gray)",
                fontSize: "0.8rem",
              }}
            >
              Salir
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
