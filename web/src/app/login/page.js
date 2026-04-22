import { signIn } from "@/auth";

export const metadata = { title: "Login — SplitMate" };

export default function LoginPage() {
  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ backgroundColor: "var(--color-dark-navy)" }}
    >
      <div className="card shadow-lg border-0 p-4" style={{ maxWidth: 400, width: "100%" }}>
        <div className="card-body text-center">
          <h1 className="fw-bold mb-1" style={{ color: "var(--color-dark-navy)", fontSize: "2rem" }}>
            SplitMate ✈️
          </h1>
          <p className="text-muted mb-4">
            Divide gastos con tus amigos sin dramas. ¡Todos felices, nadie en deuda!
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="btn w-100 d-flex align-items-center justify-content-center gap-2 py-2"
              style={{
                backgroundColor: "var(--color-terracotta)",
                color: "#fff",
                border: "none",
                fontWeight: 600,
              }}
            >
              <GoogleIcon />
              Continuar con Google
            </button>
          </form>

          <p className="text-muted mt-4" style={{ fontSize: "0.8rem" }}>
            Al ingresar aceptas que tus gastos van a quedar al descubierto 👀
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#fff"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#fff"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
        fill="#fff"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#fff"
      />
    </svg>
  );
}
