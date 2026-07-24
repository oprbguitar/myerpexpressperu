/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useState } from "react";
import { api } from "../api";
import { Button, Field, TextInput } from "../components/Ui";

export function ChangePasswordPage() {
  const [message, setMessage] = useState("");
  return <div className="centered-form"><form onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: data.get("current"), password: data.get("password") }) })
      .then(() => { location.href = "/organizacion"; })
      .catch(() => setMessage("No se pudo cambiar la contraseña."));
  }}><h1>Cambie su contraseña</h1><p>Por seguridad, debe definir una contraseña propia antes de continuar.</p>
    <Field label="Contraseña temporal"><TextInput name="current" type="password" required autoComplete="current-password" /></Field>
    <Field label="Nueva contraseña"><TextInput name="password" type="password" required minLength={12} autoComplete="new-password" /></Field>
    {message ? <div className="form-alert">{message}</div> : null}<Button type="submit">Actualizar contraseña</Button>
  </form></div>;
}
export function ResetRequestPage() {
  const [message, setMessage] = useState("");
  return <div className="centered-form"><form onSubmit={(event) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    void api("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }).then(() => setMessage("Si la cuenta existe, se generó una solicitud de recuperación."));
  }}><h1>Recuperar contraseña</h1><p>Ingrese el correo asignado por su organización.</p>
    <Field label="Correo electrónico"><TextInput name="email" type="email" required /></Field>
    {message ? <div className="notice">{message}</div> : null}<Button type="submit">Solicitar recuperación</Button>
  </form></div>;
}
