import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { ApiError } from "../api";
import { Button, Field, TextInput } from "../components/Ui";

const schema = z.object({ email: z.email("Ingrese un correo válido."), password: z.string().min(1, "Ingrese su contraseña.") });
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, login, refresh } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const redirectTarget = useRef("/");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  if (user && !isSubmitting) return <Navigate to={redirectTarget.current} replace />;
  return (
    <div className="login-layout">
      <section className="login-brand-panel">
        <div className="login-brand"><span className="brand-mark" />ERP Express Perú</div>
        <div>
          <h1>Operación clara.<br />Control confiable.</h1>
          <p>Ventas, compras, caja e inventario conectados sobre un núcleo empresarial portable y seguro.</p>
        </div>
        <small>Fase 2 · Operación comercial</small>
      </section>
      <section className="login-form-panel">
        <form onSubmit={(event) => void handleSubmit(async (values) => {
          setServerError("");
          try {
            const result = await login(values.email, values.password);
            redirectTarget.current = result.forcePasswordChange ? "/cambiar-clave" : "/";
            await refresh();
            await navigate(redirectTarget.current);
          } catch (error) {
            setServerError(error instanceof ApiError ? error.message : "No se pudo iniciar sesión.");
          }
        })(event)}>
          <h2>Iniciar sesión</h2>
          <p>Ingrese con las credenciales asignadas por su organización.</p>
          <Field label="Correo electrónico" error={errors.email?.message} required>
            <TextInput type="email" autoComplete="email" autoFocus {...register("email")} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message} required>
            <TextInput type="password" autoComplete="current-password" {...register("password")} />
          </Field>
          {serverError ? <div className="form-alert" role="alert">{serverError}</div> : null}
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Verificando…" : "Ingresar"}</Button>
          <a href="/recuperar-clave">¿Olvidó su contraseña?</a>
        </form>
      </section>
    </div>
  );
}
