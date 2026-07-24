/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, ApiError } from "../api";
import { deleteDraft, getDraft, saveDraft } from "../drafts";
import { Save, Upload } from "../components/Icons";
import { Button, Field, LoadingState, PageHeader, TextInput } from "../components/Ui";

const schema = z.object({
  legalName: z.string().min(2, "Ingrese la razón social."),
  commercialName: z.string().optional(),
  ruc: z.string().regex(/^\d{11}$/, "El RUC debe contener 11 dígitos."),
  classification: z.enum(["private_company", "public_company", "public_entity"]),
  economicActivityCode: z.string().optional(),
  mainCurrency: z.string().length(3),
  timeZone: z.string().min(1),
  fiscalAddress: z.string().optional(),
  ubigeo: z.string().regex(/^\d{6}$/, "Ingrese un ubigeo de 6 dígitos.").optional().or(z.literal("")),
  email: z.email("Ingrese un correo válido.").optional().or(z.literal("")),
  phone: z.string().optional(),
  version: z.number().int().positive(),
  status: z.string(),
  updatedAt: z.string()
});
type Company = z.infer<typeof schema>;
const draftKey = "company-current";

export default function CompanyPage() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const company = useQuery({ queryKey: ["company"], queryFn: () => api<Company>("/companies/current") });
  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<Company>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (!company.data) return;
    void getDraft<Company>(draftKey).then((draft) => {
      reset(draft ? { ...company.data, ...draft, version: company.data.version } : company.data);
      if (draft) setNotice("Se recuperó un borrador local pendiente.");
    });
  }, [company.data, reset]);
  useEffect(() => {
    const subscription = watch((value) => {
      if (isDirty) void saveDraft(draftKey, value);
    });
    return () => subscription.unsubscribe();
  }, [isDirty, watch]);
  const update = useMutation({
    mutationFn: (values: Company) => api<Company>("/companies/current", { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["company"], data);
      reset(data);
      await deleteDraft(draftKey);
      setNotice("Los cambios se guardaron y registraron en auditoría.");
    },
    onError: (error) => setNotice(error instanceof ApiError ? error.message : "No se pudo guardar.")
  });
  if (company.isLoading) return <LoadingState label="Cargando configuración…" />;
  if (company.error || !company.data) return <div className="page-error">No se pudo cargar la configuración empresarial.</div>;
  return (
    <form className="company-page" onSubmit={(event) => void handleSubmit((values) => update.mutate(values))(event)}>
      <PageHeader
        eyebrow="Organización / Empresa"
        title="Configuración de empresa"
        action={<Button type="submit" disabled={update.isPending}><Save />{update.isPending ? "Guardando…" : "Guardar cambios"}</Button>}
      />
      <div className="section-tabs" role="tablist" aria-label="Secciones de configuración">
        <button type="button" role="tab" aria-selected="true" onClick={() => document.getElementById("legal-name")?.focus()}>Datos generales</button>
        <button type="button" role="tab" aria-selected="false" onClick={() => document.getElementById("company-ruc")?.focus()}>Identificación fiscal</button>
        <button type="button" role="tab" aria-selected="false" onClick={() => document.getElementById("company-email")?.focus()}>Contacto</button>
        <button type="button" role="tab" aria-selected="false" onClick={() => document.getElementById("main-currency")?.focus()}>Configuración</button>
      </div>
      {notice ? <div className="notice" role="status">{notice}</div> : null}
      <div className="company-content">
        <div className="company-form">
          <Field label="Razón social" error={errors.legalName?.message} required><TextInput id="legal-name" {...register("legalName")} /></Field>
          <Field label="Nombre comercial"><TextInput {...register("commercialName")} /></Field>
          <Field label="RUC" error={errors.ruc?.message} required><TextInput id="company-ruc" inputMode="numeric" maxLength={11} {...register("ruc")} /></Field>
          <Field label="Clasificación" required>
            <select className="input" {...register("classification")}>
              <option value="private_company">Empresa privada</option>
              <option value="public_company">Empresa pública</option>
              <option value="public_entity">Entidad pública</option>
            </select>
          </Field>
          <Field label="Actividad económica"><TextInput placeholder="Código CIIU" {...register("economicActivityCode")} /></Field>
          <div className="field-row">
            <Field label="Moneda principal" required>
              <select id="main-currency" className="input" {...register("mainCurrency")}><option value="PEN">PEN · Sol peruano</option><option value="USD">USD · Dólar</option></select>
            </Field>
            <Field label="Zona horaria" required>
              <select className="input" {...register("timeZone")}><option value="America/Lima">(UTC-05:00) Lima</option></select>
            </Field>
          </div>
          <Field label="Dirección fiscal"><textarea className="input" rows={2} {...register("fiscalAddress")} /></Field>
          <Field label="Ubigeo" error={errors.ubigeo?.message}><TextInput inputMode="numeric" maxLength={6} {...register("ubigeo")} /></Field>
          <Field label="Correo" error={errors.email?.message}><TextInput id="company-email" type="email" {...register("email")} /></Field>
          <Field label="Teléfono"><TextInput type="tel" {...register("phone")} /></Field>
          <div className="logo-field">
            <Field label="Logo de la empresa">
              <label className="file-upload">
                <Upload /><span><strong>Subir logo de la empresa</strong><small>Tome una foto o seleccione una imagen. JPG o PNG, máx. 2 MB.</small></span>
                <input type="file" accept="image/jpeg,image/png" capture="environment" />
              </label>
            </Field>
          </div>
        </div>
        <aside className="company-summary">
          <h2>Resumen de la empresa</h2>
          <dl>
            <div><dt>Estado</dt><dd><span className="status status-success">Activa</span></dd></div>
            <div><dt>Validación de RUC</dt><dd>Validado localmente<br /><small>Sin conexión a SUNAT</small></dd></div>
            <div><dt>Última actualización</dt><dd>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(company.data.updatedAt))}</dd></div>
          </dl>
          <div className="warning">SUNAT no está habilitado en la Fase 1.</div>
        </aside>
      </div>
      <div className="mobile-save"><Button type="submit" disabled={update.isPending}><Save />Guardar cambios</Button></div>
    </form>
  );
}
